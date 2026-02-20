using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http;
using NQutils;
using NQutils.Config;
using NQutils.Sql;
using Orleans;
using NQ.Interfaces;
using Backend;
using Backend.Business;
using BotLib.Protocols;
using BotLib.Protocols.Queuing;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using System.Text.RegularExpressions;
using NQ.Router;
using static NQutils.HostingExtensions;

namespace ItemExportWin
{
    public static class MyDuController
    {
        private static IServiceProvider _cachedServiceProvider;
        private static string _cachedQurl;
        private static string _cachedConfigPath;
        private static bool _servicesStarted;
        private static readonly object _sync = new object();

        public static IServiceProvider BuildServices(string qurl, string? configPath = null)
        {
            var services = new ServiceCollection();
            var cfgPath = Path.GetFullPath(string.IsNullOrWhiteSpace(configPath) ? "dual.yaml" : configPath);
            if (!File.Exists(cfgPath))
            {
                throw new FileNotFoundException("Config file 'dual.yaml' not found next to the executable.", cfgPath);
            }
            Config.ReadYamlFile("itemexport", cfgPath);
            var q = string.IsNullOrWhiteSpace(qurl) ? "http://queueing:9630" : qurl;
            services
                .AddSingleton<ISql, Sql>()
                .AddInitializableSingleton<IGameplayBank, GameplayBank>()
                .AddInitializableSingleton<IRecipes, Recipes>()
                .AddSingleton<ILocalizationManager, LocalizationManager>()
                .AddTransient<IDataAccessor, DataAccessor>()
                .AddOrleansClient("IntegrationTests")
                .AddHttpClient()
                .AddTransient<NQutils.Stats.IStats, NQutils.Stats.FakeIStats>()
                .AddSingleton<IQueuing, RealQueuing>(sp =>
                {
                    var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient();
                    ApplyQueueingAuthHeaders(http);
                    return new RealQueuing(q, http);
                })
                ;
            var sp = services.BuildServiceProvider();
            return sp;
        }

        private static IServiceProvider GetOrCreateServices(string qurl, string? configPath = null)
        {
            lock (_sync)
            {
                var cfgPath = Path.GetFullPath(string.IsNullOrWhiteSpace(configPath) ? "dual.yaml" : configPath);
                if (_cachedServiceProvider != null
                    && string.Equals(_cachedQurl, qurl, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(_cachedConfigPath, cfgPath, StringComparison.OrdinalIgnoreCase))
                {
                    return _cachedServiceProvider;
                }
                try
                {
                    var d = _cachedServiceProvider as IDisposable;
                    if (d != null)
                    {
                        d.Dispose();
                    }
                }
                catch { }
                _servicesStarted = false;
                _cachedQurl = qurl;
                _cachedConfigPath = cfgPath;
                _cachedServiceProvider = BuildServices(qurl, configPath);
                return _cachedServiceProvider;
            }
        }

        public static void DisposeServices()
        {
            lock (_sync)
            {
                try
                {
                    var d = _cachedServiceProvider as IDisposable;
                    if (d != null)
                    {
                        d.Dispose();
                    }
                }
                catch { }
                _cachedServiceProvider = null;
                _servicesStarted = false;
                _cachedQurl = null;
                _cachedConfigPath = null;
            }
        }

        private static void ApplyQueueingAuthHeaders(HttpClient http)
        {
            try
            {
                dynamic cfg = Config.Instance;
                string apiKey = cfg.itemexport?.queueing?.api_key ?? string.Empty;
                string bearer = cfg.itemexport?.queueing?.bearer_token ?? string.Empty;
                string basicUser = cfg.itemexport?.queueing?.basic_user ?? string.Empty;
                string basicPass = cfg.itemexport?.queueing?.basic_pass ?? string.Empty;

                if (!string.IsNullOrWhiteSpace(apiKey))
                {
                    http.DefaultRequestHeaders.Remove("X-Api-Key");
                    http.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
                }
                if (!string.IsNullOrWhiteSpace(bearer))
                {
                    http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", bearer);
                }
                else if (!string.IsNullOrWhiteSpace(basicUser))
                {
                    var raw = System.Text.Encoding.ASCII.GetBytes(basicUser + ":" + (basicPass ?? string.Empty));
                    var b64 = Convert.ToBase64String(raw);
                    http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", b64);
                }
            }
            catch { }
        }

        public static async Task WithServices(string qurl, Func<IServiceProvider, Task> action, string? configPath = null)
        {
            var sp = GetOrCreateServices(qurl, configPath);
            if (!_servicesStarted)
            {
                try
                {
                    await sp.StartServices();
                    _servicesStarted = true;
                }
                catch (Exception ex)
                {
                    DisposeServices();
                    throw new InvalidOperationException("Failed to connect to services. Ensure the server is running and try again.", ex);
                }
            }
            try
            {
                await action(sp);
            }
            catch
            {
                DisposeServices();
                throw;
            }
        }

        public static System.Collections.Generic.List<object> ParseYamlDocuments(string yaml)
        {
            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .IgnoreUnmatchedProperties()
                .Build();
            var docs = new System.Collections.Generic.List<object>();
            var parts = Regex.Split(yaml, @"(?m)^(?:---|\.\.\.)\s*$");
            foreach (var part in parts)
            {
                if (string.IsNullOrWhiteSpace(part))
                    continue;
                using var sr = new StringReader(part);
                var doc = deserializer.Deserialize<object>(sr);
                if (doc != null)
                    docs.Add(doc);
            }
            return docs;
        }

        public static JArray TransformItems(
            System.Collections.Generic.List<object> docs, string? sizeFilter, int? tierMin, int? tierMax,
            bool includeDescriptions, System.Collections.Generic.IEnumerable<string> requiredProps)
        {
            var required = new System.Collections.Generic.HashSet<string>(requiredProps ?? new string[0], StringComparer.OrdinalIgnoreCase);
            var array = JArray.FromObject(docs);
            var filtered = new JArray();
            foreach (var wrapper in array.Children<JObject>())
            {
                JObject itemObj = wrapper;
                if (wrapper.Properties().Count() == 1)
                {
                    var wp = wrapper.Properties().First();
                    if (wp.Value is JObject inner)
                        itemObj = inner;
                }

                var dh = itemObj.Property("displayHidden")?.Value;
                bool isHidden = false;
                if (dh != null)
                {
                    if (dh.Type == JTokenType.Boolean) isHidden = dh.Value<bool>();
                    else if (dh.Type == JTokenType.String) isHidden = string.Equals(dh.ToString(), "true", StringComparison.OrdinalIgnoreCase);
                    else if (dh.Type == JTokenType.Integer) isHidden = dh.Value<int>() != 0;
                }
                if (isHidden)
                    continue;

                var parentVal = itemObj.Property("parent")?.Value?.ToString();
                if (parentVal == "GameplayObject" || parentVal == "DataItem")
                    continue;

                if (!string.IsNullOrEmpty(sizeFilter))
                {
                    var rawScale = itemObj.Property("scale")?.Value?.ToString();
                    var rawSize = itemObj.Property("Size")?.Value?.ToString();
                    var itemSize = (rawSize ?? rawScale) ?? string.Empty;
                    if (!sizeFilter.Contains($"|{itemSize}|", StringComparison.OrdinalIgnoreCase))
                        continue;
                }

                if (tierMin.HasValue || tierMax.HasValue)
                {
                    int parsedLevel;
                    var levelText = itemObj.Property("level")?.Value?.ToString() ?? itemObj.Property("Tier")?.Value?.ToString();
                    if (!int.TryParse(levelText, out parsedLevel))
                        continue;
                    if (tierMin.HasValue && parsedLevel < tierMin.Value)
                        continue;
                    if (tierMax.HasValue && parsedLevel > tierMax.Value)
                        continue;
                }

                // required properties check
                if (required.Count > 0)
                {
                    bool ok = true;
                    foreach (var rp in required)
                    {
                        switch (rp)
                        {
                            case "scale":
                            case "Size":
                                if (itemObj.Property("scale") == null && itemObj.Property("Size") == null) ok = false;
                                break;
                            case "level":
                            case "Tier":
                                if (itemObj.Property("level") == null && itemObj.Property("Tier") == null) ok = false;
                                break;
                            default:
                                if (itemObj.Property(rp) == null) ok = false;
                                break;
                        }
                        if (!ok) break;
                    }
                    if (!ok) continue;
                }

                var scaleProp = itemObj.Property("scale");
                if (scaleProp != null)
                {
                    var value = scaleProp.Value;
                    scaleProp.Remove();
                    itemObj["Size"] = value;
                }

                var levelProp = itemObj.Property("level");
                if (levelProp != null)
                {
                    var value = levelProp.Value;
                    levelProp.Remove();
                    itemObj["Tier"] = value;
                }

                if (!includeDescriptions)
                {
                    itemObj.Remove("displayName");
                    itemObj.Remove("subdescription");
                }

                filtered.Add(wrapper);
            }
            return filtered;
        }

        public static string PrettyForLog(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            var norm = text.Replace("\r\n", "\n").Replace("\r", "\n");
            if (!norm.EndsWith("\n")) norm += "\n";
            return norm.Replace("\n", Environment.NewLine);
        }

        public static string FilterYamlByParent(string fullYaml, string parentValue)
        {
            if (string.IsNullOrEmpty(fullYaml) || string.IsNullOrEmpty(parentValue)) return string.Empty;
            var parts = Regex.Split(fullYaml, @"(?m)^(?:---|\.\.\.)\s*$");
            var sb = new System.Text.StringBuilder();
            foreach (var part in parts)
            {
                var doc = part;
                if (string.IsNullOrWhiteSpace(doc)) continue;
                if (Regex.IsMatch(doc, @"(?m)^\s*parent:\s*" + Regex.Escape(parentValue) + @"\s*$", RegexOptions.IgnoreCase))
                {
                    sb.AppendLine("---");
                    sb.Append(doc.TrimEnd());
                    sb.AppendLine();
                }
            }
            return sb.ToString();
        }

        public static async Task<System.Collections.Generic.Dictionary<string, object>> TransformRecipesAsync(
            System.Collections.Generic.List<Backend.SRecipe> source,
            IServiceProvider sp,
            System.Collections.Generic.Dictionary<string, string>? nameMap,
            bool includeDescriptions)
        {
            var bank = sp.GetRequiredService<IGameplayBank>();
            var result = new System.Collections.Generic.Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in source)
            {
                string outType = r.Out != null && r.Out.Count > 0 && r.Out[0].Count > 0 ? r.Out[0].First().Key : string.Empty;
                double outQty = r.Out != null && r.Out.Count > 0 && r.Out[0].Count > 0 ? r.Out[0].First().Value : 0.0;
                if (string.IsNullOrEmpty(outType))
                    continue;
                var def = bank.GetDefinition(outType);
                string itemName;
                if (nameMap != null && nameMap.TryGetValue(outType, out var mapped)) itemName = mapped;
                else itemName = def != null ? def.Name : outType;
                string itemYaml = string.Empty;
                try
                {
                    if (def != null)
                    {
                        itemYaml = await bank.GetYaml(def.Id);
                    }
                }
                catch { }

                string size = ExtractScalar(itemYaml, "scale");
                if (string.IsNullOrEmpty(size))
                    size = InferSizeFrom(outType, itemName);

                var levelFromInputs = InferLevelFromInputs(r);
                int levelFromDef = TryParseTier(def);
                int level = 0;
                if (int.TryParse(ExtractScalar(itemYaml, "level"), out var levelFromYaml) && levelFromYaml > 0)
                    level = levelFromYaml;
                else if (levelFromDef > 0)
                    level = levelFromDef;
                else if (levelFromInputs.HasValue)
                    level = levelFromInputs.Value;
                string industry = r.Industries != null && r.Industries.Count > 0 ? r.Industries[0] : string.Empty;
                string industryName = MapIndustryToDisplay(industry, size);
                var ingredients = new System.Collections.Generic.List<object>();
                if (r.In != null)
                {
                    foreach (var entry in r.In)
                    {
                        foreach (var kv in entry)
                        {
                            var idef = bank.GetDefinition(kv.Key);
                            string iname;
                            if (nameMap != null && nameMap.TryGetValue(kv.Key, out var imapped)) iname = imapped;
                            else iname = idef != null ? idef.Name : kv.Key;
                            string ingredientYaml = string.Empty;
                            try
                            {
                                if (idef != null)
                                {
                                    ingredientYaml = await bank.GetYaml(idef.Id);
                                }
                            }
                            catch { }
                            string isize = ExtractScalar(ingredientYaml, "scale");
                            if (string.IsNullOrEmpty(isize))
                                isize = InferSizeFrom(kv.Key, iname);
                            string isizeUpper = string.IsNullOrEmpty(isize) ? string.Empty : isize.ToUpperInvariant();
                            string inameWithSize = string.IsNullOrEmpty(isizeUpper) ? iname : iname + " " + isizeUpper;
                            ingredients.Add(new { Name = inameWithSize, Quantity = kv.Value, Type = kv.Key });
                        }
                    }
                }
                string sizeUpper = string.IsNullOrEmpty(size) ? string.Empty : size.ToUpperInvariant();
                string productName = string.IsNullOrEmpty(sizeUpper) ? itemName : itemName + " " + sizeUpper;
                var products = new System.Collections.Generic.List<object>();
                products.Add(new { Name = productName, Quantity = outQty, Type = outType });
                if (r.Out != null)
                {
                    bool firstSkipped = false;
                    foreach (var oentry in r.Out)
                    {
                        foreach (var okv in oentry)
                        {
                            if (!firstSkipped && okv.Key == outType && okv.Value == outQty)
                            {
                                firstSkipped = true;
                                continue;
                            }
                            var pdef = bank.GetDefinition(okv.Key);
                            string pname;
                            if (nameMap != null && nameMap.TryGetValue(okv.Key, out var pmapped)) pname = pmapped;
                            else pname = pdef != null ? pdef.Name : okv.Key;
                            string pyaml = string.Empty;
                            try
                            {
                                if (pdef != null)
                                {
                                    pyaml = await bank.GetYaml(pdef.Id);
                                }
                            }
                            catch { }
                            string psize = ExtractScalar(pyaml, "scale");
                            if (string.IsNullOrEmpty(psize))
                                psize = InferSizeFrom(okv.Key, pname);
                            string psizeUpper = string.IsNullOrEmpty(psize) ? string.Empty : psize.ToUpperInvariant();
                            string pnameWithSize = string.IsNullOrEmpty(psizeUpper) ? pname : pname + " " + psizeUpper;
                            products.Add(new { Name = pnameWithSize, Quantity = okv.Value, Type = okv.Key });
                        }
                    }
                }
                string parentGroupName = string.Empty;
                try
                {
                    var parent = ExtractScalar(itemYaml, "parent");
                    if (!string.IsNullOrEmpty(parent))
                    {
                        var pdef = bank.GetDefinition(parent);
                        parentGroupName = pdef != null ? pdef.Name : parent;
                    }
                }
                catch { }
                var entryObj = new System.Collections.Generic.Dictionary<string, object?>
                {
                    ["Level"] = level,
                    ["Id"] = r.Id,
                    ["Products"] = products,
                    ["Time"] = (double)r.Time,
                    ["Ingredients"] = ingredients,
                    ["GroupId"] = "",
                    ["NqId"] = 0,
                    ["SchemaType"] = null,
                    ["SchemaPrice"] = 0.0,
                    ["UnitMass"] = TryGetUnitMass(def) ?? 0.0,
                    ["UnitVolume"] = TryGetUnitVolume(def) ?? 0.0,
                    ["Nanocraftable"] = r.Nanocraftable,
                    ["Size"] = size,
                    ["Industry"] = industryName,
                    ["Name"] = productName,
                    ["ParentGroupName"] = parentGroupName
                };
                result[outType] = entryObj;
            }
            return result;
        }

        public static string ExtractScalar(string yaml, string key)
        {
            if (string.IsNullOrEmpty(yaml) || string.IsNullOrEmpty(key)) return string.Empty;
            var rx = new Regex("^\\s*" + Regex.Escape(key) + ":\\s*(.+)$", RegexOptions.Multiline);
            var m = rx.Match(yaml);
            if (!m.Success) return string.Empty;
            var val = m.Groups[1].Value.Trim();
            if (val.StartsWith("\"") && val.EndsWith("\"")) val = val.Substring(1, val.Length - 2);
            return val;
        }

        public static double? TryGetUnitMass(object def)
        {
            try
            {
                if (def == null) return null;
                var bo = def.GetType().GetProperty("BaseObject")?.GetValue(def);
                var value = bo?.GetType().GetProperty("unitMass")?.GetValue(bo);
                if (value is double d) return d;
                if (value is float f) return (double)f;
            }
            catch { }
            return null;
        }

        public static double? TryGetUnitVolume(object def)
        {
            try
            {
                if (def == null) return null;
                var bo = def.GetType().GetProperty("BaseObject")?.GetValue(def);
                var value = bo?.GetType().GetProperty("unitVolume")?.GetValue(bo);
                if (value is double d) return d;
                if (value is float f) return (double)f;
            }
            catch { }
            return null;
        }

        public static int TryParseTier(object def)
        {
            try
            {
                if (def == null) return 0;
                var bo = def.GetType().GetProperty("BaseObject")?.GetValue(def);
                var lv = bo?.GetType().GetProperty("level")?.GetValue(bo);
                if (lv is int i) return i;
                if (lv is long l) return (int)l;
                if (lv is string s && int.TryParse(s, out var si)) return si;
            }
            catch { }
            return 0;
        }

        public static int? InferLevelFromInputs(Backend.SRecipe r)
        {
            if (r.In == null) return null;
            foreach (var entry in r.In)
            {
                foreach (var k in entry.Keys)
                {
                    var m = Regex.Match(k, "_(\\d+)$");
                    if (m.Success && int.TryParse(m.Groups[1].Value, out var lvl)) return lvl;
                }
            }
            return null;
        }

        public static string MapIndustryToDisplay(string industry, string size)
        {
            if (string.IsNullOrEmpty(industry)) return string.Empty;

            string tierWordFromDigit(string digit)
            {
                if (string.IsNullOrEmpty(digit)) return "Basic";
                switch (digit)
                {
                    case "2": return "Unc";
                    case "3": return "Adv";
                    case "4": return "Rare";
                    case "5": return "Exotic";
                    default: return "Basic";
                }
            }

            var mAsm = Regex.Match(industry, @"^IndustryAssembly(?<size>XS|S|M|L|XL|XXL|XXXL)(?<tier>[2-5]?)$", RegexOptions.IgnoreCase);
            if (mAsm.Success)
            {
                var tier = mAsm.Groups["tier"].Value;
                var tierWord = tierWordFromDigit(tier);
                var sizeDisplay = (string.IsNullOrEmpty(size) ? mAsm.Groups["size"].Value : size).ToLowerInvariant();
                return tierWord + " Assembly Line " + sizeDisplay;
            }

            var mOther = Regex.Match(industry, @"^Industry(?<type>Chemical|Electronics|Glass|Honeycomber|Metalwork|Recycler|Refiner|Smelter)(?<tier>[2-5]?)$", RegexOptions.IgnoreCase);
            if (mOther.Success)
            {
                var type = mOther.Groups["type"].Value;
                var tier = mOther.Groups["tier"].Value;
                var tierWord = tierWordFromDigit(tier);
                var sizeDisplay = size != null ? size.ToLowerInvariant() : string.Empty;
                string mappedType = type;
                if (type.Equals("Honeycomber", StringComparison.OrdinalIgnoreCase))
                    mappedType = "Honeycomb Refinery";
                else
                    mappedType = type + " Industry";
                return tierWord + " " + mappedType + (string.IsNullOrEmpty(sizeDisplay) ? string.Empty : " " + sizeDisplay);
            }

            return industry;
        }

        public static string InferSizeFrom(string typeName, string itemName)
        {
            var mType = Regex.Match(typeName, @"(xxxl|xxl|xl|xs|s|m|l)$", RegexOptions.IgnoreCase);
            if (mType.Success) return mType.Groups[1].Value;
            var mName = Regex.Match(itemName, @"\s(xxxl|xxl|xl|xs|s|m|l)$", RegexOptions.IgnoreCase);
            if (mName.Success) return mName.Groups[1].Value;
            return string.Empty;
        }

        public static bool IsNameExcluded(string gkey)
        {
            return (gkey + "").StartsWith("Deprecated", StringComparison.OrdinalIgnoreCase) ||
                   (gkey + "").StartsWith("Rock", StringComparison.OrdinalIgnoreCase) ||
                   (gkey + "").EndsWith("Config", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Admin screen", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "AdminScreenSignUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "AlienDecoUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "ArkshipDecoUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "ArtifactUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Asset", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "BuildTool", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Character", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "CollectibleUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Construct", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Decor", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "ExploreTool", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "FeaturesList", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Pet", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Talent", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "TalentGroup", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Other", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "BlueprintBase", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "ConstructKey", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "ConveyorBeltUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "DecoTerritoryUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "EnergyUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "FactoryUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "GravityChangerUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "InvalidItem", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "MarketPodUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "MarketUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "MineableMaterial", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "MissionPackageContentAphelia", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "OreDeprecated", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "RawwwMaterial", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Package", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Placeholder", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "ScannerResult", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "SolarSystemPlanet", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "SpeakerUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "TerritoryKey", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "TogglerUnit", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "Tool", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(gkey, "VideoScreenUnit", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Populates runtime caches in MyDuData (NameMap, DocMap, IdMap) in a single pass.
        /// </summary>
        public static void PopulateItemCaches(
            System.Collections.Generic.List<object> docs,
            IGameplayBank bank)
        {
            MyDuData.NameMap.Clear();
            MyDuData.DocMap.Clear();
            MyDuData.IdMap.Clear();
            MyDuData.ParentMap.Clear();

            var array = JArray.FromObject(docs);
            foreach (var wrapper in array.Children<JObject>())
            {
                if (wrapper.Properties().Count() != 1)
                {
                    continue;
                }

                var p = wrapper.Properties().First();
                var typeKey = p.Name;
                if (p.Value is JObject itemObj)
                {
                    var parentKey = itemObj.Property("parent")?.Value?.ToString();
                    if (string.IsNullOrWhiteSpace(parentKey))
                    {
                        if (typeKey.StartsWith("AtmosphericVerticalBooster", StringComparison.OrdinalIgnoreCase)
                            && typeKey.EndsWith("Group", StringComparison.OrdinalIgnoreCase))
                        {
                            parentKey = "VerticalBooster";
                            itemObj["parent"] = parentKey;
                        }
                        else if (typeKey.StartsWith("HoverEngine", StringComparison.OrdinalIgnoreCase)
                            && typeKey.EndsWith("Group", StringComparison.OrdinalIgnoreCase))
                        {
                            parentKey = "Hovercraft";
                            itemObj["parent"] = parentKey;
                        }
                        else if (Regex.IsMatch(typeKey, "^Container(?:Small|Medium|Large|XL|XXL|XXXL)(?:GravityInverted|Optimised)(?:[2345])?$", RegexOptions.CultureInvariant))
                        {
                            parentKey = "ItemContainer";
                            itemObj["parent"] = parentKey;
                        }
                    }
                    if (IsNameExcluded(typeKey) || (!string.IsNullOrEmpty(parentKey) && IsNameExcluded(parentKey)))
                    {
                        continue;
                    }
                    MyDuData.DocMap[typeKey] = itemObj;
                    var displayName = itemObj.Property("displayName")?.Value?.ToString();
                    if (!string.IsNullOrWhiteSpace(displayName))
                    {
                        MyDuData.NameMap[typeKey] = displayName;
                    }
                    var gi = new ItemExportWin.GroupInfo
                    {
                        Key = typeKey,
                        Name = displayName,
                        Description = itemObj.Property("description")?.Value?.ToString(),
                        ParentKey = parentKey,
                        Depth = 0,
                        GroupId = 0,
                        ParentId = 0,
                        SchematicRequired = false,
                    };
                    if (!string.IsNullOrWhiteSpace(parentKey) && MyDuData.ParentMap.TryGetValue(parentKey, out var parentGi))
                    {
                        gi.SchematicRequired = parentGi.SchematicRequired;
                    }
                    if (string.Equals(typeKey, "ConsumableDisplay", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(typeKey, "Element", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(typeKey, "Material", StringComparison.OrdinalIgnoreCase))
                    {
                        gi.SchematicRequired = true;
                    }
                    MyDuData.ParentMap[typeKey] = gi;
                }

                var id = bank.IdFor(typeKey);
                if (id != 0 && MyDuData.ParentMap.TryGetValue(typeKey, out var gi2))
                {
                    MyDuData.IdMap[typeKey] = id;
                    gi2.GroupId = id;
                    MyDuData.ParentMap[typeKey] = gi2;
                }
            }
        }
    }
}
