using Backend;
using Backend.Business;
using BotLib.Protocols;
using BotLib.Protocols.Queuing;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NQ.Interfaces;
using NQ.Router;
using NQutils;
using NQutils.Config;
using NQutils.Sql;
using Orleans;
using System;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Runtime.ConstrainedExecution;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using YamlDotNet.Core.Tokens;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;
using static NQutils.HostingExtensions;

namespace ItemExportWin
{
    public partial class MainForm : Form
    {
        // Groups cache
        private System.Collections.Generic.List<string> _groups = new System.Collections.Generic.List<string>();

        /// <summary>
        /// Initializes the form and default selections.
        /// </summary>
        public MainForm()
        {
            InitializeComponent();
            cmbMode.SelectedIndex = 0;
        }

        /// <summary>
        /// Appends a message to the log textbox.
        /// </summary>
        /// <param name="msg">Message to append.</param>
        private void Log(string msg)
        {
            if (memoLog.TextLength > 0) memoLog.AppendText(Environment.NewLine);
            memoLog.AppendText(msg);
        }

        /// <summary>
        /// Wrapper to build/start services using UI configuration and run an action.
        /// </summary>
        /// <param name="action">Action to execute with the service provider.</param>
        private async Task WithServices(Func<IServiceProvider, Task> action)
        {
            var qurl = txtQueueing.Text?.Trim();
            if (string.IsNullOrEmpty(qurl)) qurl = "http://queueing:9630";
            await MyDuController.WithServices(qurl, action, "dual.yaml");
        }

        private void BeginProgress(int maximum)
        {
            progress.Visible = true;
            progress.Minimum = 0;
            progress.Maximum = Math.Max(0, maximum);
            progress.Value = 0;
        }

        private void IncrementProgress()
        {
            if (progress.Visible && progress.Value < progress.Maximum)
            {
                progress.Value += 1;
            }
        }

        private void EndProgress()
        {
            progress.Visible = false;
            progress.Value = 0;
        }

        /// <summary>
        /// Tests backend connectivity and basic data paths.
        /// </summary>
        /// <param name="sender">Event source.</param>
        /// <param name="e">Event arguments.</param>
        private async void btnTest_Click(object sender, EventArgs e)
        {
            memoLog.Clear();
            Log("Testing connection...");
            try
            {
                await WithServices(async sp =>
                {
                    var bank = sp.GetRequiredService<IGameplayBank>();
                    var yaml = await bank.Export();
                    var docs = ParseYamlDocuments(yaml);
                    Log("Building items preview...");
                    BeginProgress(JArray.FromObject(docs).Children<JObject>().Count());
                    JArray itemsArray;
                    try
                    {
                        itemsArray = TransformItems(docs, null, null, null, chkLangEn.Checked);
                    }
                    finally
                    {
                        EndProgress();
                    }
                    var recipes = sp.GetRequiredService<IRecipes>();
                    var rlist = await recipes.GetAllPretty();
                    Log($"OK. Items: {itemsArray.Count}, Recipes: {rlist.Count}");
                });
            }
            catch (Exception ex)
            {
                Log($"ERROR: {ex.Message}");
            }
        }

        /// <summary>
        /// Executes export according to selected mode and options.
        /// </summary>
        /// <param name="sender">Event source.</param>
        /// <param name="e">Event arguments.</param>
        private async void btnExport_Click(object sender, EventArgs e)
        {
            memoLog.Clear();
            Log("Starting export...");
            try
            {
                Backend.IGameplayBank bank = null;

                // Pull game objects data - currently only from live MyDU server
                // TODO: optional loading of yaml from file
                Log("Connecting to services (30s timeout)...");
                var connectTask1 = WithServices(async sp =>
                {
                    bank = sp.GetRequiredService<IGameplayBank>();
                    MyDuData.DuYaml = await bank.Export();
                });
                var completed1 = await Task.WhenAny(connectTask1, Task.Delay(TimeSpan.FromSeconds(30)));
                if (completed1 != connectTask1)
                {
                    Log("ERROR: Timeout connecting to services. Ensure the server is running and try again.");
                    MyDuController.DisposeServices();
                    return;
                }
                await connectTask1;
                Log("Connected.");

                if (string.IsNullOrWhiteSpace(MyDuData.DuYaml))
                {
                    Log("ERROR: Bank YAML is empty. Aborting export.");
                    return;
                }

                MyDuData.BankDocs = ParseYamlDocuments(MyDuData.DuYaml);
                if (MyDuData.BankDocs == null || MyDuData.BankDocs.Count == 0)
                {
                    Log("ERROR: Parsed bank documents are empty. Aborting export.");
                    return;
                }

                MyDuController.PopulateItemCaches(MyDuData.BankDocs, bank);
                if (MyDuData.NameMap.Count == 0)
                {
                    Log("ERROR: Item name map is empty. No displayName entries found in bank YAML. Aborting export.");
                    return;
                }

                LoadGroups();

                // YAML export independent of mode when enabled and checked
                if (chkExportYaml.Enabled && chkExportYaml.Checked)
                {
                    var suggested = Path.GetFullPath(txtOutYaml.Text.Trim());
                    var saveYaml = PromptSavePath(suggested, "YAML files (*.yaml)|*.yaml|All files (*.*)|*.*", "yaml");
                    if (saveYaml == null)
                    {
                        Log("YAML export canceled.");
                    }
                    else
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(saveYaml) ?? ".");
                        var bankOut = InjectNqIdsIntoBankYaml(MyDuData.DuYaml, MyDuData.IdMap);
                        File.WriteAllText(saveYaml, bankOut);
                        Log($"YAML written: {saveYaml}");
                    }
                }

                // Talents YAML export independent of mode when enabled and checked
                if (chkExportTalents.Enabled && chkExportTalents.Checked)
                {
                    var talentsYaml = FilterYamlByParent(MyDuData.DuYaml, "Talent");
                    if (!string.IsNullOrWhiteSpace(talentsYaml))
                    {
                        var baseYaml = Path.GetFullPath(txtOutYaml.Text.Trim());
                        var baseDir = Path.GetDirectoryName(baseYaml) ?? ".";
                        var suggestedTalents = Path.Combine(baseDir, "talents.yaml");
                        var saveTalents = PromptSavePath(suggestedTalents, "YAML files (*.yaml)|*.yaml|All files (*.*)|*.*", "yaml");
                        if (saveTalents == null)
                        {
                            Log("Talents YAML export canceled.");
                        }
                        else
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(saveTalents) ?? ".");
                            var talentsOut = InjectNqIdsIntoBankYaml(talentsYaml, MyDuData.IdMap);
                            File.WriteAllText(saveTalents, talentsOut);
                            Log($"YAML written: {saveTalents}");
                        }
                    }
                    else
                    {
                        Log("No Talents found to export.");
                    }
                }

                // Schematics YAML export independent of mode when enabled and checked
                if (chkExportSchematics.Enabled && chkExportSchematics.Checked)
                {
                    var schematicsYaml = FilterYamlByParent(MyDuData.DuYaml, "Schematic");
                    if (!string.IsNullOrWhiteSpace(schematicsYaml))
                    {
                        var baseYaml = Path.GetFullPath(txtOutYaml.Text.Trim());
                        var baseDir = Path.GetDirectoryName(baseYaml) ?? ".";
                        var suggestedSchematics = Path.Combine(baseDir, "schematics.yaml");
                        var saveSchematics = PromptSavePath(suggestedSchematics, "YAML files (*.yaml)|*.yaml|All files (*.*)|*.*", "yaml");
                        if (saveSchematics == null)
                        {
                            Log("Schematics YAML export canceled.");
                        }
                        else
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(saveSchematics) ?? ".");
                            var schemOut = InjectNqIdsIntoBankYaml(schematicsYaml, MyDuData.IdMap);
                            File.WriteAllText(saveSchematics, schemOut);
                            Log($"YAML written: {saveSchematics}");
                        }
                    }
                    else
                    {
                        Log("No Schematics found to export.");
                    }
                }

                // Talents JSON export independent of mode when enabled and checked
                if (chkExportTalentsJson.Enabled && chkExportTalentsJson.Checked)
                {
                    var talentsArray = ExtractDocsByParent(MyDuData.BankDocs, "Talent");
                    if (talentsArray.Count > 0)
                    {
                        var baseJson = Path.GetFullPath(txtOutJson.Text.Trim());
                        var baseDir = Path.GetDirectoryName(baseJson) ?? ".";
                        var suggestedTalentsJson = Path.Combine(baseDir, "talents.json");
                        var saveTalentsJson = PromptSavePath(suggestedTalentsJson, "JSON files (*.json)|*.json|All files (*.*)|*.*", "json");
                        Directory.CreateDirectory(Path.GetDirectoryName(saveTalentsJson) ?? ".");
                        File.WriteAllText(saveTalentsJson, talentsArray.ToString(Formatting.Indented));
                        Log($"JSON written: {saveTalentsJson}");
                    }
                    else
                    {
                        Log("No Talents found to export.");
                    }
                }

                // Schematics JSON export independent of mode when enabled and checked
                if (chkExportSchematicsJson.Enabled && chkExportSchematicsJson.Checked)
                {
                    var itemToSchema = BuildSchematicProductMap(MyDuData.BankDocs, MyDuData.NameMap, MyDuData.DocMap);
                    var schematicsIndex = BuildSchematicCatalogJson(MyDuData.BankDocs, itemToSchema, MyDuData.DocMap, MyDuData.IdMap);
                    if (schematicsIndex != null && schematicsIndex.HasValues)
                    {
                        var baseJson = Path.GetFullPath(txtOutJson.Text.Trim());
                        var baseDir = Path.GetDirectoryName(baseJson) ?? ".";
                        var suggestedSchematicsJson = Path.Combine(baseDir, "schematics.json");
                        var saveSchematicsJson = PromptSavePath(suggestedSchematicsJson, "JSON files (*.json)|*.json|All files (*.*)|*.*", "json");
                        Directory.CreateDirectory(Path.GetDirectoryName(saveSchematicsJson) ?? ".");
                        File.WriteAllText(saveSchematicsJson, schematicsIndex.ToString(Formatting.Indented));
                        Log($"JSON written: {saveSchematicsJson}");
                    }
                    else
                    {
                        Log("No Schematics found to export.");
                    }
                }

                string? itemsPath = null;
                var mode = cmbMode.SelectedIndex; // 0=Recipes Only, 1=Items only, 2=Items and Recipes
                if (mode != 0)
                {
                    var activeGroups = _groups;

                    string? sizeFilter = BuildSizeFilter();
                    int? tierMin = numTierMin.Value > 0 ? (int?)numTierMin.Value : null;
                    int? tierMax = numTierMax.Value > 0 ? (int?)numTierMax.Value : null;
                    JArray items;
                    if (chkRecipesTransform.Checked)
                    {
                        Log("Transforming items for JSON export...");
                        BeginProgress(JArray.FromObject(MyDuData.BankDocs).Children<JObject>().Count());
                        try
                        {
                            items = TransformItems(MyDuData.BankDocs, sizeFilter, tierMin, tierMax, chkLangEn.Checked);
                        }
                        finally
                        {
                            EndProgress();
                        }
                    }
                    else
                    {
                        items = JArray.FromObject(MyDuData.BankDocs);
                        // Apply consistent group filtering in raw mode
                        var kept = new JArray();
                        foreach (var wrapper in items.Children<JObject>())
                        {
                            JObject itemObj = wrapper;
                            string typeKey = string.Empty;
                            if (wrapper.Properties().Count() == 1)
                            {
                                var wp = wrapper.Properties().First();
                                typeKey = wp.Name;
                                if (wp.Value is JObject inner)
                                {
                                    itemObj = inner;
                                }
                            }
                            var parentVal = itemObj.Property("parent")?.Value?.ToString();
                            if (parentVal == "GameplayObject" || parentVal == "DataItem")
                            {
                                continue;
                            }
                            if (!string.IsNullOrEmpty(typeKey) && !IsExportable(typeKey))
                            {
                                continue;
                            }
                            kept.Add(wrapper);
                        }
                        items = kept;
                    }
                    var itemsJson = items.ToString(Formatting.Indented);
                    var suggestedJson = Path.GetFullPath(txtOutJson.Text.Trim());
                    itemsPath = PromptSavePath(suggestedJson, "JSON files (*.json)|*.json|All files (*.*)|*.*", "json");
                    if (itemsPath == null)
                    {
                        Log("JSON export canceled.");
                        return;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(itemsPath) ?? ".");
                    File.WriteAllText(itemsPath, itemsJson);
                    Log($"JSON written: {itemsPath}");
                }

                if (mode == 0 || mode == 2)
                {
                    Log("Connecting to services for recipes (30s timeout)...");
                    var connectTask2 = WithServices(async sp =>
                    {
                        await ExportRecipes(sp, itemsPath);
                    });
                    var completed2 = await Task.WhenAny(connectTask2, Task.Delay(TimeSpan.FromSeconds(30)));
                    if (completed2 != connectTask2)
                    {
                        Log("ERROR: Timeout connecting to services (recipes). Ensure the server is running and try again.");
                        MyDuController.DisposeServices();
                        return;
                    }
                    await connectTask2;
                    Log("Finished using services for recipes.");
                }

                Log("Export done.");
            }
            catch (Exception ex)
            {
                Log($"ERROR: {ex.Message}");
            }
        }

        /// <summary>
        /// Looks up a recipe by numeric id and logs its YAML.
        /// </summary>
        /// <param name="sender">Event source.</param>
        /// <param name="e">Event arguments.</param>
        private async void btnItemLookupId_Click(object sender, EventArgs e)
        {
            try
            {
                await WithServices(async sp =>
                {
                    var recipes = sp.GetRequiredService<IRecipes>();
                    var id = (ulong)editItemLookupId.Value;
                    try
                    {
                        var yaml = await recipes.ExportOne(id);
                        if (string.IsNullOrWhiteSpace(yaml))
                        {
                            Log($"Recipe {id}: not found");
                        }
                        else
                        {
                            Log($"Recipe {id} details:\r\n{PrettyForLog(yaml)}");
                        }
                    }
                    catch (Exception)
                    {
                        Log($"Recipe {id}: not found");
                    }
                });
            }
            catch (Exception ex)
            {
                Log($"ERROR: {ex.Message}");
            }
        }

        /// <summary>
        /// Looks up an item by exact name and logs its YAML.
        /// </summary>
        /// <param name="sender">Event source.</param>
        /// <param name="e">Event arguments.</param>
        private async void btnItemLookupName_Click(object sender, EventArgs e)
        {
            try
            {
                await WithServices(async sp =>
                {
                    var bank = sp.GetRequiredService<IGameplayBank>();
                    var name = (editItemLookupName.Text ?? string.Empty).Trim();
                    if (string.IsNullOrEmpty(name))
                    {
                        Log("Name: empty");
                        return;
                    }
                    var def = bank.GetDefinition(name);
                    if (def == null)
                    {
                        Log($"Name '{name}': not found");
                    }
                    else
                    {
                        try
                        {
                            var yaml = await bank.GetYaml(def.Id);
                            Log($"Item '{name}' ({def.Id}) details:\r\n{PrettyForLog(yaml)}");
                        }
                        catch (Exception)
                        {
                            Log($"Item '{name}' ({def.Id}) - failed to fetch YAML");
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                Log($"ERROR: {ex.Message}");
            }
        }

        private async void btnMakeRecipeItems_Click(object sender, EventArgs e)
        {
            try
            {
                Log("Generating RecipeItems YAML...");
                await WithServices(async sp =>
                {
                    var recipes = sp.GetRequiredService<IRecipes>();
                    var yaml = await recipes.MakeRecipeItems();
                    Log("RecipeItems YAML generated.");
                    var outDir = Path.Combine(AppContext.BaseDirectory, "data");
                    Directory.CreateDirectory(outDir);
                    var outPath = Path.Combine(outDir, "all_recipes.yaml");
                    Log("Saving to data\\all_recipes.yaml...");
                    File.WriteAllText(outPath, yaml);
                    Log($"YAML written: {outPath}");
                });
            }
            catch (Exception ex)
            {
                Log($"ERROR: {ex.Message}");
            }
        }

        /// <summary>
        /// Builds distinct list of parent groups from bank documents.
        /// </summary>
        private void LoadGroups()
        {
            if (MyDuData.BankDocs == null || MyDuData.BankDocs.Count() == 0 || MyDuData.IdMap == null)
            {
                return;
            }
            try
            {
                // Build unique set of all parent IDs
                var set = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var parentGi in MyDuData.ParentMap.Values)
                {
                    var parentKey = parentGi.ParentKey;
                    if (!string.IsNullOrWhiteSpace(parentKey))
                    {
                        set.Add(parentKey);
                    }
                }

                var groupsMap = new System.Collections.Generic.Dictionary<string, GroupInfo>(StringComparer.OrdinalIgnoreCase);
                var queue = new System.Collections.Generic.Queue<string>();
                if (MyDuData.DocMap != null)
                {
                    foreach (var k in MyDuData.DocMap.Keys)
                    {
                        if (!string.IsNullOrEmpty(k) && set.Contains(k) && !MyDuController.IsNameExcluded(k))
                        {
                            queue.Enqueue(k);
                        }
                    }
                }

                var xseen = 0;
                var seen = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var ordered = new System.Collections.Generic.List<string>();
                while (queue.Count > 0)
                {
                    var gkey = queue.Dequeue();
                    if (string.IsNullOrEmpty(gkey))
                    {
                        continue;
                    }
                    if (!seen.Add(gkey))
                    {
                        xseen++;
                        continue;
                    }
                    MyDuData.DocMap.TryGetValue(gkey, out var gdoc);
                    if (gdoc == null)
                    {
                        continue;
                    }

                    if (MyDuController.IsNameExcluded(gkey))
                    {
                        continue;
                    }

                    string name = gdoc.Property("displayName")?.Value?.ToString() ?? gkey;
                    string desc = gdoc.Property("description")?.Value?.ToString() ?? string.Empty;
                    string parentKey = MyDuData.ParentMap.TryGetValue(gkey, out var tmpGi)
                        ? (tmpGi.ParentKey ?? string.Empty)
                        : (gdoc.Property("parent")?.Value?.ToString() ?? string.Empty);
                    if (string.IsNullOrEmpty(parentKey) || MyDuController.IsNameExcluded(parentKey) || !IsWithinAllowedRoots(gkey, 5))
                    {
                        continue;
                    }

                    ulong gid = 0;
                    MyDuData.IdMap.TryGetValue(gkey, out gid);
                    ulong pid = 0;
                    if (!string.IsNullOrEmpty(parentKey))
                    {
                        MyDuData.IdMap.TryGetValue(parentKey, out pid);
                    }
                    var gi = new GroupInfo
                    {
                        Key = gkey,
                        Name = name,
                        Description = desc,
                        GroupId = gid,
                        ParentId = pid,
                        ParentKey = parentKey
                    };
                    groupsMap[gkey] = gi;
                    ordered.Add(gkey);
                }
                _groups = ordered;

                var children = new System.Collections.Generic.Dictionary<string, System.Collections.Generic.List<string>>(StringComparer.OrdinalIgnoreCase);
                var roots = new System.Collections.Generic.List<string>();
                if (MyDuData.DocMap != null)
                {
                    foreach (var key in MyDuData.DocMap.Keys)
                    {
                        if (!groupsMap.ContainsKey(key))
                        {
                            continue;
                        }
                        var gi0 = groupsMap[key];
                        var pk0 = gi0.ParentKey;
                        if (string.IsNullOrEmpty(pk0) || !groupsMap.ContainsKey(pk0))
                        {
                            roots.Add(key);
                        }
                        else
                        {
                            if (!children.TryGetValue(pk0, out var list))
                            {
                                list = new System.Collections.Generic.List<string>();
                                children[pk0] = list;
                            }
                            list.Add(key);
                        }
                    }
                }
                var orderedGroups = new System.Collections.Generic.List<string>();
                var visitedTree = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                System.Action<string> addWithChildren = null;
                addWithChildren = (key) =>
                {
                    if (string.IsNullOrEmpty(key))
                    {
                        return;
                    }
                    if (!visitedTree.Add(key))
                    {
                        return;
                    }
                    orderedGroups.Add(key);
                    if (children.TryGetValue(key, out var list))
                    {
                        foreach (var child in list)
                        {
                            addWithChildren(child);
                        }
                    }
                };
                foreach (var root in roots)
                {
                    addWithChildren(root);
                }
                _groups = orderedGroups;

                var sb = new System.Text.StringBuilder();
                foreach (var key in _groups)
                {
                    if (!groupsMap.TryGetValue(key, out var g)) { continue; }
                    sb.Append(g.GroupId);
                    sb.Append('\t');
                    sb.Append(g.ParentId);
                    sb.Append('\t');
                    sb.Append(g.Key);
                    sb.Append('\t');
                    sb.Append(g.Name);
                    sb.Append('\t');
                    sb.AppendLine(g.Description ?? string.Empty);
                }
                var outPath = System.IO.Path.Combine(AppContext.BaseDirectory, "groups.txt");
                System.IO.File.WriteAllText(outPath, sb.ToString());

                Log($"Loaded groups: {_groups.Count}");
            }
            catch (Exception ex)
            {
                Log($"Failed building groups: {ex.Message}");
            }
        }

        private static bool IsWithinAllowedRoots(string key, int maxDepth)
        {
            if (string.IsNullOrEmpty(key))
            {
                return false;
            }

            maxDepth = Math.Max(maxDepth, 8);
            string cur = key;
            int depth = 0;
            while (!string.IsNullOrEmpty(cur) && depth <= maxDepth)
            {
                if (string.Equals(cur, "ConsumableDisplay", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(cur, "Element", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(cur, "Material", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(cur, "Schematic", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
                string parentKey = null;
                if (MyDuData.ParentMap.TryGetValue(cur, out var gi))
                {
                    parentKey = gi.ParentKey;
                }
                else if (MyDuData.DocMap.TryGetValue(cur, out var doc))
                {
                    parentKey = doc.Property("parent")?.Value?.ToString();
                }
                if (string.IsNullOrEmpty(parentKey)
                    || string.Equals(parentKey, "DataItem", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(parentKey, "GameplayObject", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
                cur = parentKey;
                depth++;
            }
            return false;
        }

        private static bool IsExportable(string key)
        {
            if (string.IsNullOrEmpty(key))
            {
                return false;
            }
            string cur = key;
            bool seenDeprecatedPart = false;
            int guard = 0;
            var visited = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            while (!string.IsNullOrEmpty(cur) && guard++ < 64 && visited.Add(cur))
            {
                if (!MyDuData.DocMap.TryGetValue(cur, out var doc))
                {
                    break;
                }
                var parent = doc.Property("parent")?.Value?.ToString();
                if (string.IsNullOrEmpty(parent)
                    || string.Equals(parent, "GameplayObject", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
                if (string.Equals(parent, "Consumable", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(parent, "Schematic", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
                if (string.Equals(parent, "DeprecatedPart", StringComparison.OrdinalIgnoreCase))
                {
                    seenDeprecatedPart = true;
                }
                if (string.Equals(parent, "Part", StringComparison.OrdinalIgnoreCase))
                {
                    return !seenDeprecatedPart;
                }
                cur = parent;
            }
            return false;
        }

        /// <summary>
        /// Splits a YAML stream into documents and normalizes scalar types.
        /// </summary>
        /// <param name="yaml">Multi-document YAML.</param>
        /// <returns>List of deserialized documents.</returns>
        private static System.Collections.Generic.List<object> ParseYamlDocuments(string yaml)
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
                var raw = deserializer.Deserialize<object>(sr);
                var doc = NormalizeYamlObject(raw);
                if (doc != null)
                    docs.Add(doc);
            }
            return docs;
        }

        /// <summary>
        /// Recursively converts YAML scalar strings to numeric/bool types where applicable.
        /// </summary>
        private static object NormalizeYamlObject(object value)
        {
            if (value == null) return value;
            if (value is System.Collections.IDictionary odict)
            {
                var result = new System.Collections.Generic.Dictionary<string, object>();
                foreach (System.Collections.DictionaryEntry de in odict)
                {
                    var key = de.Key?.ToString() ?? string.Empty;
                    result[key] = NormalizeYamlObject(de.Value);
                }
                return result;
            }
            if (value is System.Collections.IList list)
            {
                var arr = new System.Collections.Generic.List<object>();
                foreach (var item in list)
                {
                    arr.Add(NormalizeYamlObject(item));
                }
                return arr;
            }
            if (value is string s)
            {
                if (long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var li)) return li;
                if (double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var ld)) return ld;
                if (bool.TryParse(s, out var lb)) return lb;
                return s;
            }
            return value;
        }

        /// <summary>
        /// Extracts documents having a specific parent key from a YAML stream.
        /// </summary>
        /// <param name="fullYaml">Full multi-document YAML stream.</param>
        /// <param name="parentValue">Parent value to match exactly.</param>
        private static string FilterYamlByParent(string fullYaml, string parentValue)
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

        private static JArray ExtractDocsByParent(System.Collections.Generic.List<object> docs, string parent)
        {
            var result = new JArray();
            if (docs == null || docs.Count == 0 || string.IsNullOrEmpty(parent)) return result;
            var array = JArray.FromObject(docs);
            foreach (var wrapper in array.Children<JObject>())
            {
                if (wrapper.Properties().Count() != 1) continue;
                var p = wrapper.Properties().First();
                var obj = p.Value as JObject;
                if (obj == null) continue;
                var parentVal = obj.Property("parent")?.Value?.ToString();
                if (string.Equals(parentVal, parent, StringComparison.Ordinal))
                {
                    result.Add(wrapper);
                }
            }
            return result;
        }

        private static string InjectNqIdsIntoBankYaml(string fullYaml, System.Collections.Generic.Dictionary<string, ulong>? idMap)
        {
            if (string.IsNullOrEmpty(fullYaml) || idMap == null || idMap.Count == 0) return fullYaml;
            var deserializer = new DeserializerBuilder()
                .IgnoreUnmatchedProperties()
                .Build();
            var serializer = new SerializerBuilder()
                .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
                .Build();
            var parts = Regex.Split(fullYaml, @"(?m)^(?:---|\.\.\.)\s*$");
            var sb = new System.Text.StringBuilder();
            foreach (var part in parts)
            {
                var doc = part;
                if (string.IsNullOrWhiteSpace(doc)) continue;
                try
                {
                    var root = deserializer.Deserialize<object>(doc) as System.Collections.IDictionary;
                    if (root == null || root.Count != 1)
                    {
                        sb.AppendLine("---");
                        sb.Append(doc.TrimEnd());
                        sb.AppendLine();
                        continue;
                    }
                    var en = root.GetEnumerator();
                    if (!en.MoveNext())
                    {
                        sb.AppendLine("---");
                        sb.Append(doc.TrimEnd());
                        sb.AppendLine();
                        continue;
                    }
                    var typeKey = en.Key != null ? en.Key.ToString() : string.Empty;
                    if (string.IsNullOrEmpty(typeKey) || !idMap.TryGetValue(typeKey, out var id))
                    {
                        sb.AppendLine("---");
                        sb.Append(doc.TrimEnd());
                        sb.AppendLine();
                        continue;
                    }
                    object valueObj = en.Value;
                    var inner = valueObj as System.Collections.IDictionary;
                    var innerObjObj = valueObj as System.Collections.Generic.IDictionary<object, object>;
                    var innerStrObj = valueObj as System.Collections.Generic.IDictionary<string, object>;
                    if (inner != null)
                    {
                        if (!inner.Contains("nqId")) inner["nqId"] = id;
                    }
                    else if (innerObjObj != null)
                    {
                        if (!innerObjObj.ContainsKey("nqId")) innerObjObj["nqId"] = id;
                    }
                    else if (innerStrObj != null)
                    {
                        if (!innerStrObj.ContainsKey("nqId")) innerStrObj["nqId"] = id;
                    }
                    else
                    {
                        sb.AppendLine("---");
                        sb.Append(doc.TrimEnd());
                        sb.AppendLine();
                        continue;
                    }
                    sb.AppendLine("---");
                    // Re-wrap into a one-key map for serialization
                    var wrap = new System.Collections.Generic.Dictionary<object, object>();
                    wrap[typeKey] = valueObj;
                    sb.Append(serializer.Serialize(wrap).TrimEnd());
                    sb.AppendLine();
                }
                catch
                {
                    sb.AppendLine("---");
                    sb.Append(doc.TrimEnd());
                    sb.AppendLine();
                }
            }
            return sb.ToString();
        }

        private static System.Collections.Generic.Dictionary<string, string> BuildSchematicProductMap(
            System.Collections.Generic.List<object> docs,
            System.Collections.Generic.Dictionary<string, string> nameMap,
            System.Collections.Generic.Dictionary<string, JObject> docMap)
        {
            var result = new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (docs == null || docs.Count == 0) return result;
            var array = JArray.FromObject(docs);
            foreach (var wrapper in array.Children<JObject>())
            {
                if (wrapper.Properties().Count() != 1) continue;
                var p = wrapper.Properties().First();
                var typeKey = p.Name;
                var item = p.Value as JObject;
                if (item == null) continue;
                var parent = item.Property("parent")?.Value?.ToString();
                if (!string.Equals(parent, "Schematic", StringComparison.Ordinal)) continue;
                // Prefer explicit productionItems; else use productionBaseItem with size/level filters
                var prodItems = item.Property("productionItems")?.Value as JArray;
                if (prodItems != null && prodItems.Count > 0)
                {
                    foreach (var tok in prodItems)
                    {
                        var key = tok?.ToString();
                        if (string.IsNullOrEmpty(key)) continue;
                        if (!result.ContainsKey(key)) result[key] = typeKey;
                    }
                    continue;
                }
                var baseItems = item.Property("productionBaseItem")?.Value as JArray;
                if (baseItems == null || baseItems.Count == 0) continue;
                var sizeFilterArr = item.Property("productionScalesFilter")?.Value as JArray;
                var levelFilterTok = item.Property("productionLevelFilter")?.Value;
                int levelFilter = -1;
                if (levelFilterTok != null) int.TryParse(levelFilterTok.ToString(), out levelFilter);
                var sizes = sizeFilterArr != null ? sizeFilterArr.Values<string>().Select(s => NormalizeSize(s)).Where(s => !string.IsNullOrEmpty(s)).Select(s => s.ToUpperInvariant()).ToHashSet(StringComparer.OrdinalIgnoreCase) : null;
                var excludedArr = item.Property("productionExcluded")?.Value as JArray;
                var excluded = excludedArr != null ? excludedArr.Values<string>().Select(s => s?.Trim()).Where(s => !string.IsNullOrEmpty(s)).ToHashSet(StringComparer.OrdinalIgnoreCase) : null;
                foreach (var tok in baseItems)
                {
                    var baseKey = tok?.ToString();
                    if (string.IsNullOrEmpty(baseKey)) continue;
                    foreach (var kv in docMap)
                    {
                        var key = kv.Key;
                        string cur = key;
                        bool inGroup = false;
                        int guard = 0;
                        var visited = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        while (!string.IsNullOrEmpty(cur) && guard++ < 64 && visited.Add(cur))
                        {
                            if (!docMap.TryGetValue(cur, out var curDoc)) break;
                            var par = curDoc.Property("parent")?.Value?.ToString();
                            if (string.Equals(par, baseKey, StringComparison.OrdinalIgnoreCase)) { inGroup = true; break; }
                            cur = par;
                        }
                        if (!inGroup) continue;
                        if (excluded != null)
                        {
                            string exCur = key;
                            int exGuard = 0;
                            var exVisited = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                            bool isExcluded = false;
                            while (!string.IsNullOrEmpty(exCur) && exGuard++ < 64 && exVisited.Add(exCur))
                            {
                                if (excluded.Contains(exCur)) { isExcluded = true; break; }
                                if (!docMap.TryGetValue(exCur, out var exDoc)) break;
                                exCur = exDoc.Property("parent")?.Value?.ToString();
                            }
                            if (isExcluded) continue;
                        }
                        var doc = kv.Value;
                        var size = doc.Property("scale")?.Value?.ToString();
                        if (string.IsNullOrEmpty(size))
                        {
                            string dn;
                            if (nameMap != null && nameMap.TryGetValue(key, out dn))
                            {
                                var inferred = InferSizeFrom(key, dn ?? string.Empty);
                                if (!string.IsNullOrEmpty(inferred))
                                {
                                    size = inferred.ToUpperInvariant();
                                }
                            }
                            else
                            {
                                var inferred = InferSizeFrom(key, string.Empty);
                                if (!string.IsNullOrEmpty(inferred))
                                {
                                    size = inferred.ToUpperInvariant();
                                }
                            }
                        }
                        var lvlStr = doc.Property("level")?.Value?.ToString();
                        int lvlParsed = 0; int.TryParse(lvlStr, out lvlParsed);
                        if (sizes != null)
                        {
                            if (string.IsNullOrEmpty(size)) continue;
                            if (!sizes.Contains(size)) continue;
                        }
                        if (levelFilter >= 0 && lvlParsed != levelFilter) continue;
                        if (!result.ContainsKey(key)) result[key] = typeKey;
                    }
                }
            }
            return result;
        }

        /// <summary>
        /// Builds a compact schematics catalog keyed by shorthand SchemaType codes.
        /// </summary>
        private static JObject BuildSchematicCatalogJson(
            System.Collections.Generic.List<object> docs,
            System.Collections.Generic.Dictionary<string, string> itemToSchemaMap,
            System.Collections.Generic.Dictionary<string, JObject> docMap,
            System.Collections.Generic.Dictionary<string, ulong> idMap)
        {
            if (docs == null || docs.Count == 0)
            {
                return new JObject();
            }
            var acc = new System.Collections.Generic.SortedDictionary<string, JToken>(StringComparer.OrdinalIgnoreCase);
            var array = JArray.FromObject(docs);
            foreach (var wrapper in array.Children<JObject>())
            {
                if (wrapper.Properties().Count() != 1) continue;
                var p = wrapper.Properties().First();
                var typeKey = p.Name;
                var item = p.Value as JObject;
                if (item == null) continue;
                var parent = item.Property("parent")?.Value?.ToString();
                if (!string.Equals(parent, "Schematic", StringComparison.Ordinal)) continue;

                var code = ComputeSchematicCodeForDoc(typeKey, item, docMap);
                if (string.IsNullOrEmpty(code)) continue;

                ulong sid = 0;
                if (idMap != null) idMap.TryGetValue(typeKey, out sid);
                string name = item.Property("displayName")?.Value?.ToString() ?? typeKey;
                if (!string.IsNullOrEmpty(name))
                {
                    name = Regex.Replace(name, "\\s*Schematic\\s*Copy$", " Schematic", RegexOptions.IgnoreCase);
                }
                int level = 0;
                var lvlTok = item.Property("productionLevelFilter")?.Value;
                if (lvlTok != null && int.TryParse(lvlTok.ToString(), out var lvlParsed)) level = lvlParsed;
                string scale = string.Empty;
                var scalesArr = item.Property("productionScalesFilter")?.Value as JArray;
                if (scalesArr != null && scalesArr.Count > 0) scale = (scalesArr[0]?.ToString() ?? string.Empty).ToUpperInvariant();

                // Hard-coded tier levels for standalone schematics without explicit level
                if (level <= 0)
                {
                    if (string.Equals(code, "TerritoryUnit", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(code, "WarpBeacon", StringComparison.OrdinalIgnoreCase))
                    {
                        level = 5;
                    }
                    else if (string.Equals(code, "WarpCell", StringComparison.OrdinalIgnoreCase))
                    {
                        level = 3;
                    }
                    }

                bool researchable = false;
                var rschTok = item.Property("researchable")?.Value;
                if (rschTok != null)
                {
                    if (rschTok.Type == JTokenType.Boolean) researchable = rschTok.Value<bool>();
                    else if (rschTok.Type == JTokenType.Integer) researchable = rschTok.Value<int>() != 0;
                    else if (rschTok.Type == JTokenType.String) researchable = string.Equals(rschTok.Value<string>(), "true", StringComparison.OrdinalIgnoreCase);
                }
                double researchCostQuanta = 0.0;
                var rcqTok = item.Property("researchCostQuanta")?.Value;
                if (rcqTok != null)
                {
                    if (rcqTok.Type == JTokenType.Float) researchCostQuanta = rcqTok.Value<double>();
                    else if (rcqTok.Type == JTokenType.Integer) researchCostQuanta = Convert.ToDouble(rcqTok.Value<long>());
                    else if (rcqTok.Type == JTokenType.String)
                    {
                        double.TryParse(rcqTok.Value<string>(), NumberStyles.Float, CultureInfo.InvariantCulture, out researchCostQuanta);
                    }
                }
                int researchCostTimeSeconds = 0;
                var rctsTok = item.Property("researchCostTimeSeconds")?.Value;
                if (rctsTok != null)
                {
                    if (rctsTok.Type == JTokenType.Integer) researchCostTimeSeconds = Convert.ToInt32(rctsTok.Value<long>());
                    else if (rctsTok.Type == JTokenType.String)
                    {
                        int.TryParse(rctsTok.Value<string>(), out researchCostTimeSeconds);
                    }
                }
                int researchBatchSize = 0;
                var rbsTok = item.Property("researchBatchSize")?.Value;
                if (rbsTok != null)
                {
                    if (rbsTok.Type == JTokenType.Integer) researchBatchSize = Convert.ToInt32(rbsTok.Value<long>());
                    else if (rbsTok.Type == JTokenType.String)
                    {
                        int.TryParse(rbsTok.Value<string>(), out researchBatchSize);
                    }
                }

                if (!acc.ContainsKey(code))
                {
                    var obj = new JObject
                    {
                        ["Key"] = code,
                        ["Name"] = name,
                        ["Cost"] = researchCostQuanta,
                        ["Level"] = level,
                        ["BatchSize"] = researchBatchSize,
                        ["BatchTime"] = researchCostTimeSeconds,
                        ["NqId"] = sid
                        //["Size"] = scale,
                        //["researchable"] = researchable
                    };
                    acc[code] = obj;
                }
            }
            var outObj = new JObject();
            foreach (var kv in acc)
            {
                outObj.Add(kv.Key, kv.Value);
            }
            return outObj;
        }

        private static string ComputeSchematicCodeForDoc(string typeKey, JObject schemDoc, System.Collections.Generic.Dictionary<string, JObject> docMap)
        {
            int level = 0;
            var lvlTok = schemDoc.Property("productionLevelFilter")?.Value;
            if (lvlTok != null) int.TryParse(lvlTok.ToString(), out level);

            string size = string.Empty;
            var scalesArr = schemDoc.Property("productionScalesFilter")?.Value as JArray;
            if (scalesArr != null && scalesArr.Count > 0)
            {
                size = (scalesArr[0]?.ToString() ?? string.Empty).ToLowerInvariant();
            }
            else
            {
                var dn = schemDoc.Property("displayName")?.Value?.ToString() ?? string.Empty;
                var mSize = Regex.Match(dn, "(xxxl|xxl|xl|xs|s|m|l)", RegexOptions.IgnoreCase);
                if (mSize.Success) size = mSize.Groups[1].Value.ToLowerInvariant();
            }

            // Prefer deriving the family from the type key to avoid misclassification
            string baseMarker = ResolveBaseMarkerFromTypeKey(typeKey);
            if (string.IsNullOrEmpty(baseMarker))
            {
                baseMarker = ResolveBaseMarkerForSchematic(schemDoc, docMap);
            }
            if (string.IsNullOrEmpty(baseMarker))
            {
                return null;
            }
            return DeriveSchematicKey(baseMarker, size, level);
        }

        private static string ResolveBaseMarkerFromTypeKey(string typeKey)
        {
            if (string.IsNullOrEmpty(typeKey)) return string.Empty;
            if (Regex.IsMatch(typeKey, "Bonsai", RegexOptions.IgnoreCase)) return "Bonsai";
            if (Regex.IsMatch(typeKey, "ConstructSupport", RegexOptions.IgnoreCase)) return "ConstructSupport";
            if (Regex.IsMatch(typeKey, "CoreUnit", RegexOptions.IgnoreCase)) return "CoreUnit";
            if (Regex.IsMatch(typeKey, "TerritoryUnit", RegexOptions.IgnoreCase)) return "TerritoryUnit";
            if (Regex.IsMatch(typeKey, "WarpBeacon", RegexOptions.IgnoreCase)) return "WarpBeacon";
            if (Regex.IsMatch(typeKey, "WarpCell", RegexOptions.IgnoreCase)) return "WarpCell";
            if (Regex.IsMatch(typeKey, "AtmoFuel", RegexOptions.IgnoreCase)) return "AtmoFuel";
            if (Regex.IsMatch(typeKey, "SpaceFuel", RegexOptions.IgnoreCase)) return "SpaceFuels";
            if (Regex.IsMatch(typeKey, "RocketFuel", RegexOptions.IgnoreCase)) return "RocketFuels";
            if (Regex.IsMatch(typeKey, "PureHoneycomb", RegexOptions.IgnoreCase)) return "PureHoneycomb";
            if (Regex.IsMatch(typeKey, "Honeycomb", RegexOptions.IgnoreCase)) return "Honeycomb";
            if (Regex.IsMatch(typeKey, "Scrap", RegexOptions.IgnoreCase)) return "Scrap";
            if (Regex.IsMatch(typeKey, "Ammo", RegexOptions.IgnoreCase)) return "Ammo";
            if (Regex.IsMatch(typeKey, "ProductMaterial", RegexOptions.IgnoreCase)) return "ProductMaterial";
            if (Regex.IsMatch(typeKey, "PureMaterial", RegexOptions.IgnoreCase)) return "PureMaterial";
            if (Regex.IsMatch(typeKey, "Element", RegexOptions.IgnoreCase)) return "Element";
            return string.Empty;
        }

        private static string ResolveBaseMarkerForSchematic(JObject schemDoc, System.Collections.Generic.Dictionary<string, JObject> docMap)
        {
            var baseArr = schemDoc.Property("productionBaseItem")?.Value as JArray;
            if (baseArr != null && baseArr.Count > 0)
            {
                foreach (var bt in baseArr)
                {
                    var s = bt?.ToString() ?? string.Empty;
                    if (string.IsNullOrEmpty(s)) continue;
                    var lowered = s.ToLowerInvariant();
                    if (lowered == "adjustor" || lowered == "airfoil" || lowered == "aileron" || lowered == "brake")
                    {
                        return "ConstructSupport";
                    }
                    var markerFromKey = ResolveBaseMarkerFromTypeKey(s);
                    if (!string.IsNullOrEmpty(markerFromKey)) return markerFromKey;
                    if (docMap != null && docMap.TryGetValue(s, out var gdoc0))
                    {
                        var disp0 = gdoc0.Property("displayName")?.Value?.ToString() ?? string.Empty;
                        if (Regex.IsMatch(disp0, "Pure\\s*Honeycomb", RegexOptions.IgnoreCase)) return "PureHoneycomb";
                        if (Regex.IsMatch(disp0, "Honeycomb", RegexOptions.IgnoreCase)) return "Honeycomb";
                    }

                    // Ascend parent chain for group tokens to detect ConstructSupport family
                    if (docMap != null && docMap.TryGetValue(s, out var gdoc))
                    {
                        string cur = s;
                        int guard = 0;
                        var visited = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        while (!string.IsNullOrEmpty(cur) && guard++ < 64 && visited.Add(cur))
                        {
                            if (!docMap.TryGetValue(cur, out var cdoc)) break;
                            var disp = cdoc.Property("displayName")?.Value?.ToString() ?? string.Empty;
                            var markerFromCur = ResolveBaseMarkerFromTypeKey(cur);
                            if (!string.IsNullOrEmpty(markerFromCur)) return markerFromCur;
                            if (Regex.IsMatch(disp, "Construct\\s*Support", RegexOptions.IgnoreCase)) return "ConstructSupport";
                            if (Regex.IsMatch(disp, "Bonsai", RegexOptions.IgnoreCase)) return "Bonsai";
                            if (Regex.IsMatch(disp, "Pure\\s*Honeycomb", RegexOptions.IgnoreCase)) return "PureHoneycomb";
                            if (Regex.IsMatch(disp, "Honeycomb", RegexOptions.IgnoreCase)) return "Honeycomb";
                            cur = cdoc.Property("parent")?.Value?.ToString();
                        }
                    }
                }
            }

            var itemsArr = schemDoc.Property("productionItems")?.Value as JArray;
            if (itemsArr != null && itemsArr.Count > 0)
            {
                var firstType = itemsArr[0]?.ToString() ?? string.Empty;
                if (!string.IsNullOrEmpty(firstType))
                {
                    var marker = ResolveBaseMarkerFromTypeKey(firstType);
                    if (!string.IsNullOrEmpty(marker)) return marker;
                }
            }

            return string.Empty;
        }

        /// <summary>
        /// Transforms item documents into the items JSON array applying filters and normalization.
        /// </summary>
        /// <param name="docs">Parsed bank documents.</param>
        /// <param name="sizeFilter">Pipe-delimited size mask or null.</param>
        /// <param name="tierMin">Minimum tier filter.</param>
        /// <param name="tierMax">Maximum tier filter.</param>
        /// <param name="includeDescriptions">Whether to include sub-description field.</param>
        private JArray TransformItems(System.Collections.Generic.List<object> docs, string? sizeFilter, int? tierMin, int? tierMax, bool includeDescriptions)
        {
            var array = JArray.FromObject(docs);
            var filtered = new JArray();
            foreach (var obj in array.Children<JObject>())
            {
                IncrementProgress();

                // Unwrap object
                JObject itemObj = obj;
                string typeKey = string.Empty;
                if (obj.Properties().Count() == 1)
                {
                    var wp = obj.Properties().First();
                    typeKey = wp.Name;
                    if (wp.Value is JObject inner)
                        itemObj = inner;
                }

                // Exclude hidden items from export
                var dh = itemObj.Property("displayHidden")?.Value;
                bool isHidden = false;
                if (dh != null)
                {
                    if (dh.Type == JTokenType.Boolean) isHidden = dh.Value<bool>();
                    else if (dh.Type == JTokenType.String) isHidden = string.Equals(dh.ToString(), "true", StringComparison.OrdinalIgnoreCase);
                    else if (dh.Type == JTokenType.Integer) isHidden = dh.Value<int>() != 0;
                }
                if (isHidden)
                {
                    continue;
                }

                var parentVal = itemObj.Property("parent")?.Value?.ToString();
                if (parentVal == null || parentVal == "GameplayObject" || parentVal == "DataItem")
                {
                    continue;
                }

                if (!string.IsNullOrEmpty(typeKey) && !IsExportable(typeKey))
                {
                    continue;
                }

                // Normalize fields that may be required before we enforce required-property checks
                if (chkPropScale.Checked && itemObj.Property("scale") == null && itemObj.Property("Size") == null)
                {
                    var disp = itemObj.Property("displayName")?.Value?.ToString() ?? string.Empty;
                    var inferred = InferSizeFrom(typeKey, disp);
                    if (!string.IsNullOrEmpty(inferred))
                    {
                        itemObj["Size"] = inferred.ToLowerInvariant();
                    }
                }
                if (chkPropUnitVolume.Checked && itemObj.Property("unitVolume") == null)
                {
                    var maxVol = itemObj.Property("maxVolume")?.Value;
                    if (maxVol != null)
                    {
                        itemObj["unitVolume"] = maxVol;
                    }
                }

                if (!ItemHasRequiredProps(itemObj))
                {
                    var hitPoints = itemObj.Property("hitpoints")?.Value?.ToString();
                    if (typeKey == "PlasmaExtractorUnit" || typeKey == "Plasma" ||
                        (!typeKey.StartsWith("Plasma")
                         && string.IsNullOrEmpty(hitPoints)
                         && !typeKey.EndsWith("Group")
                         && !parentVal.StartsWith("Schematic")
                         && !parentVal.StartsWith("Talent")
                         && !parentVal.EndsWith("Part")))
                    {
                        Log(typeKey);
                        continue;
                    }
                }

                // Apply size filter (matches scale or Size, case-insensitive)
                if (!string.IsNullOrEmpty(sizeFilter))
                {
                    var rawScale = itemObj.Property("scale")?.Value?.ToString();
                    var rawSize = itemObj.Property("Size")?.Value?.ToString();
                    var itemSize = (rawSize ?? rawScale) ?? string.Empty;
                    if (!sizeFilter.Contains($"|{itemSize}|", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                }

                // Apply tier filter (if any bound provided). Items without level are excluded if filter is active.
                if (tierMin.HasValue || tierMax.HasValue)
                {
                    var levelText = itemObj.Property("level")?.Value?.ToString() ?? itemObj.Property("Tier")?.Value?.ToString();
                    if (!int.TryParse(levelText, out int parsedLevel))
                    {
                        continue;
                    }
                    if ((tierMin.HasValue && parsedLevel < tierMin.Value) ||
                        (tierMax.HasValue && parsedLevel > tierMax.Value))
                    {
                        continue;
                    }
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
                    itemObj.Remove("subdescription");
                }

                // Add NqId for items when we know the type key
                if (!string.IsNullOrEmpty(typeKey) && MyDuData.IdMap != null && MyDuData.IdMap.TryGetValue(typeKey, out var iid))
                {
                    itemObj["NqId"] = iid;
                }

                filtered.Add(obj);
            }
            return filtered;
        }

        /// <summary>
        /// Builds a pipe-delimited size filter mask from UI selections.
        /// </summary>
        private string? BuildSizeFilter()
        {
            var selected = new System.Collections.Generic.List<string>();
            if (chkSizeXS.Checked) selected.Add("XS");
            if (chkSizeS.Checked) selected.Add("S");
            if (chkSizeM.Checked) selected.Add("M");
            if (chkSizeL.Checked) selected.Add("L");
            if (chkSizeXL.Checked) selected.Add("XL");
            if (chkSizeXXL.Checked) selected.Add("XXL");
            if (chkSizeXXXL.Checked) selected.Add("XXXL");
            if (selected.Count == 7) return null; // all selected -> no filtering
            if (selected.Count == 0) return null; // none selected -> no filtering
            return "|" + string.Join("|", selected) + "|";
        }

        /// <summary>
        /// Normalizes text for multi-line log readability.
        /// </summary>
        private static string PrettyForLog(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            // Normalize CRLF for multiline TextBox and ensure blank line between docs if present
            var norm = text.Replace("\r\n", "\n").Replace("\r", "\n");
            // Add a newline at end if missing for better separation
            if (!norm.EndsWith("\n"))
            {
                norm += "\n";
            }
            return norm.Replace("\n", Environment.NewLine);
        }

        /// <summary>
        /// Exports recipes as JSON next to items or to default path.
        /// </summary>
        /// <param name="sp">Service provider.</param>
        /// <param name="itemsJsonPath">Items JSON path used to infer recipes path.</param>
        private async Task ExportRecipes(IServiceProvider sp, string? itemsJsonPath = null)
        {
            var recipes = sp.GetRequiredService<IRecipes>();
            Log("Fetching recipes...");
            var list = await recipes.GetAllPretty();
            if (list == null || list.Count == 0)
            {
                throw new InvalidOperationException("No recipes returned by backend. Aborting export.");
            }
            var schematicMap = BuildSchematicProductMap(MyDuData.BankDocs, MyDuData.NameMap, MyDuData.DocMap);
            // Skip MineableMaterial subtree completely (assets, not producible)
            list = list.Where(r =>
            {
                string outType = r.Out != null && r.Out.Count > 0 && r.Out[0].Count > 0 ? r.Out[0].First().Key : string.Empty;
                if (string.IsNullOrEmpty(outType)) return false;
                if (MyDuData.DocMap != null && MyDuData.DocMap.TryGetValue(outType, out var doc))
                {
                    var p = doc.Property("parent")?.Value?.ToString();
                    if (!string.IsNullOrEmpty(p) && MyDuController.IsNameExcluded(p))
                    {
                        return false;
                    }
                }
                return true;
            }).ToList();
            if (chkRecipesNanocraftable.Checked)
            {
                list = list.Where(r => r.Nanocraftable).ToList();
            }
            if (numRecipesTimeMax.Value > 0)
            {
                var tmax = (int)numRecipesTimeMax.Value;
                list = list.Where(r => r.Time <= tmax).ToList();
            }
            if (numRecipesLimit.Value > 0 && list.Count > (int)numRecipesLimit.Value)
            {
                list = list.Take((int)numRecipesLimit.Value).ToList();
            }

            string recipesJson;
            if (chkRecipesTransform.Checked)
            {
                Log($"Transforming {list.Count} recipes...");
                BeginProgress(list.Count);
                var transformed = await TransformRecipesAsync(list, sp, schematicMap);
                EndProgress();
                // Ensure numeric values stay numeric in JSON
                recipesJson = JsonConvert.SerializeObject(transformed, Formatting.Indented,
                    new JsonSerializerSettings { FloatParseHandling = FloatParseHandling.Double });
            }
            else
            {
                Log($"Preparing {list.Count} recipes (raw mode)...");
                BeginProgress(list.Count);
                JArray recipesToken = JArray.FromObject(list);
                if (chkLangEn.Checked)
                {
                    foreach (var rTok in recipesToken.Children<JObject>())
                    {
                        IncrementProgress();
                        var outArr = rTok["Out"] as JArray;
                        if (outArr == null) continue;
                        var firstEntry = outArr.Children<JObject>().FirstOrDefault();
                        if (firstEntry == null) continue;
                        var firstProp = firstEntry.Properties().FirstOrDefault();
                        if (firstProp == null) continue;
                        var keyName = firstProp.Name;
                        if (MyDuData.NameMap.TryGetValue(keyName, out var dn))
                        {
                            rTok.AddFirst(new JProperty("Name", dn));
                        }
                    }
                }
                EndProgress();
                // Ensure NqId mirrors recipe Id in raw mode
                foreach (var rTok in recipesToken.Children<JObject>())
                {
                    if (rTok.Property("Id") != null && rTok.Property("NqId") == null)
                    {
                        rTok.Add(new JProperty("NqId", rTok["Id"]));
                    }
                }
                recipesJson = recipesToken.ToString(Formatting.Indented);
            }

            string recipesPath;
            if (!string.IsNullOrWhiteSpace(itemsJsonPath))
            {
                var dir = Path.GetDirectoryName(itemsJsonPath) ?? ".";
                var name = Path.GetFileNameWithoutExtension(itemsJsonPath);
                var ext = Path.GetExtension(itemsJsonPath);
                recipesPath = Path.Combine(dir, name + ".recipes" + ext);
            }
            else
            {
                var suggested = Path.GetFullPath(txtOutJson.Text.Trim());
                var baseName = Path.GetFileNameWithoutExtension(suggested);
                var dir = Path.GetDirectoryName(suggested) ?? ".";
                recipesPath = Path.Combine(dir, baseName + ".recipes.json");
            }

            var chosen = PromptSavePath(recipesPath, "JSON files (*.json)|*.json|All files (*.*)|*.*", "json");
            if (chosen == null)
            {
                Log("Recipes export canceled.");
                return;
            }
            Directory.CreateDirectory(Path.GetDirectoryName(chosen) ?? ".");
            File.WriteAllText(chosen, recipesJson);
            Log($"JSON written: {chosen}");
        }

        /// <summary>
        /// Transforms recipes into the target JSON shape, resolving names and metadata.
        /// </summary>
        /// <param name="source">Recipe list (pretty format).</param>
        /// <param name="sp">Service provider.</param>
        private Task<System.Collections.Generic.Dictionary<string, object>> TransformRecipesAsync(
            System.Collections.Generic.List<Backend.SRecipe> source, IServiceProvider sp,
            System.Collections.Generic.Dictionary<string, string> schematicMap)
        {
            var bank = sp.GetRequiredService<IGameplayBank>();
            var recipesSvc = sp.GetRequiredService<IRecipes>();
            var idToType = new System.Collections.Generic.Dictionary<ulong, string>();
            if (MyDuData.IdMap != null)
            {
                foreach (var kv in MyDuData.IdMap)
                {
                    if (!idToType.ContainsKey(kv.Value)) idToType[kv.Value] = kv.Key;
                }
            }

            var result = new System.Collections.Generic.Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in source)
            {
                // Identify the primary product (first entry in Out) which drives root name/size/level
                IncrementProgress();
                string outType = r.Out != null && r.Out.Count > 0 && r.Out[0].Count > 0 ? r.Out[0].First().Key : string.Empty;
                double outQty = r.Out != null && r.Out.Count > 0 && r.Out[0].Count > 0 ? r.Out[0].First().Value : 0.0;
                if (string.IsNullOrEmpty(outType))
                {
                    continue;
                }

                // Resolve product definition and a readable name (preferring MyDuData.NameMap)
                var def = bank.GetDefinition(outType);
                string itemName;
                if (MyDuData.NameMap != null && MyDuData.NameMap.TryGetValue(outType, out var mapped))
                {
                    itemName = mapped;
                }
                else
                {
                    itemName = def != null ? def.Name : outType;
                }

                // Fetch YAML once for the product to reuse for size/level/parent extraction
                // Determine size: prefer 'scale' from preloaded docs, otherwise infer from type/name
                string size = string.Empty;
                if (MyDuData.DocMap.TryGetValue(outType, out var outDoc))
                {
                    var rawScale = outDoc.Property("scale")?.Value?.ToString();
                    size = NormalizeSize(rawScale);
                }
                if (string.IsNullOrEmpty(size))
                {
                    size = InferSizeFrom(outType, itemName);
                }
                if (string.IsNullOrEmpty(size) && Regex.IsMatch(outType, "^Container", RegexOptions.IgnoreCase))
                {
                    if (Regex.IsMatch(outType, "^ContainerSmall", RegexOptions.IgnoreCase)) size = "xs";
                    else if (Regex.IsMatch(outType, "^ContainerMedium", RegexOptions.IgnoreCase)) size = "s";
                    else if (Regex.IsMatch(outType, "^ContainerLarge", RegexOptions.IgnoreCase)) size = "m";
                    else if (Regex.IsMatch(outType, "^ContainerXL", RegexOptions.IgnoreCase)) size = "l";
                    else if (Regex.IsMatch(outType, "^ContainerXXL", RegexOptions.IgnoreCase)) size = "xl";
                    else if (Regex.IsMatch(outType, "^ContainerXXXL", RegexOptions.IgnoreCase)) size = "xxl";
                }

                // Determine level with precedence: doc 'level' > def.BaseObject.level > inferred from inputs
                var levelFromInputs = InferLevelFromInputs(r);
                int levelFromDef = TryParseTier(def);
                int level = 0;
                if (MyDuData.DocMap.TryGetValue(outType, out var outDoc2))
                {
                    var lvlTok = outDoc2.Property("level")?.Value?.ToString();
                    if (int.TryParse(lvlTok, out var lvlParsed) && lvlParsed > 0)
                    {
                        level = lvlParsed;
                    }
                }
                else if (levelFromDef > 0)
                {
                    level = levelFromDef;
                }
                else if (levelFromInputs.HasValue)
                {
                    level = levelFromInputs.Value;
                }

                // Map industry code to a display string; if size is still empty, fallback from industry or default 'm'
                string industry = r.Industries != null && r.Industries.Count > 0 ? r.Industries[0] : string.Empty;
                if (string.IsNullOrEmpty(size))
                {
                    var mAsmSize = Regex.Match(industry, @"^IndustryAssembly(?<size>XS|S|M|L|XL|XXL|XXXL)(?<tier>[2-5]?)$", RegexOptions.IgnoreCase);
                    if (mAsmSize.Success)
                        size = mAsmSize.Groups["size"].Value.ToLowerInvariant();
                    else
                        size = "m";
                }
                string industryName = MapIndustryToDisplay(industry, size);

                // Build ingredients array with size-suffixed names (per-ingredient YAML scale preferred)
                var ingredients = new System.Collections.Generic.List<object>();
                if (r.In != null)
                {
                    foreach (var entry in r.In)
                    {
                        foreach (var kv in entry)
                        {
                            var inameWithSize = BuildNameWithSize(kv.Key, bank);
                            ingredients.Add(new { Name = inameWithSize, Quantity = kv.Value, Type = kv.Key });
                        }
                    }
                }

                // Build full products list: first product controls root Name; include side-products as well
                string sizeLower = string.IsNullOrEmpty(size) ? string.Empty : size.ToLowerInvariant();
                string productName = string.IsNullOrEmpty(sizeLower) ? itemName : itemName + " " + sizeLower;
                var products = new System.Collections.Generic.List<object>
                {
                    new { Name = productName, Quantity = outQty, Type = outType }
                };
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
                            var pnameWithSize = BuildNameWithSize(okv.Key, bank);
                            products.Add(new { Name = pnameWithSize, Quantity = okv.Value, Type = okv.Key });
                        }
                    }
                }

                // Resolve parent group display name from the preloaded doc 'parent'
                string parentGroupName = string.Empty;
                ulong groupIdValue = 0;
                string immediateParent = string.Empty;
                if (MyDuData.DocMap.TryGetValue(outType, out var outDoc3))
                {
                    immediateParent = outDoc3.Property("parent")?.Value?.ToString() ?? string.Empty;
                }
                if (!string.IsNullOrEmpty(immediateParent)
                    && !string.Equals(immediateParent, "DataItem", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(immediateParent, "GameplayObject", StringComparison.OrdinalIgnoreCase))
                {
                    var pdef = bank.GetDefinition(immediateParent);
                    parentGroupName = pdef != null ? pdef.Name : immediateParent;
                    MyDuData.IdMap?.TryGetValue(immediateParent, out groupIdValue);
                }

                string schemaType = null;
                double schemaPrice = 0.0;
                /*
                var needed = await recipesSvc.GetNeededSchematics((ulong)r.Id);
                if (needed != null && needed.Count > 0)
                {
                    var sid = needed[0];
                    System.Tuple<string, double> sv;
                    if (schematicValues != null && schematicValues.TryGetValue(sid, out sv))
                    {
                        if (sv != null)
                        {
                            if (!string.IsNullOrEmpty(sv.Item1)) schemaType = sv.Item1;
                            schemaPrice = sv.Item2;
                        }
                    }
                    if (schemaType == null)
                    {
                        string schemKey;
                        if (idToType.TryGetValue(sid, out schemKey))
                        {
                            JObject schemDoc = null;
                            MyDuData.DocMap.TryGetValue(schemKey, out schemDoc);
                            var codeFromNeeded = ComputeSchematicCodeForDoc(schemKey, schemDoc, MyDuData.DocMap);
                            if (!string.IsNullOrEmpty(codeFromNeeded))
                            {
                                schemaType = codeFromNeeded;
                            }
                        }
                    }
                }
                */

                if (schemaType == null && schematicMap != null && schematicMap.TryGetValue(outType, out var schemaKeyFromMap))
                {
                    JObject schemDoc2 = null;
                    MyDuData.DocMap.TryGetValue(schemaKeyFromMap, out schemDoc2);
                    int slevel = level;
                    string ssize = size;
                    if (schemDoc2 != null)
                    {
                        var lvlTok2 = schemDoc2.Property("productionLevelFilter")?.Value;
                        if (lvlTok2 != null && int.TryParse(lvlTok2.ToString(), out var lvlParsed2) && lvlParsed2 > 0)
                        {
                            slevel = lvlParsed2;
                        }
                        if (schemDoc2.Property("productionScalesFilter")?.Value is JArray scalesArr2 && scalesArr2.Count > 0)
                        {
                            ssize = NormalizeSize(scalesArr2[0]?.ToString());
                        }
                    }
                    var code2 = DeriveSchematicKey(schemaKeyFromMap, ssize, slevel);
                    if (!string.IsNullOrEmpty(code2))
                    {
                        schemaType = code2;
                    }
                }

                if (schemaType == null)
                {
                    bool underPart = IsDescendantOfPart(outType);
                    if (!underPart && !string.IsNullOrEmpty(industry))
                    {
                        var codeFallback = DeriveSchematicKey("Element", size, level);
                        if (!string.IsNullOrEmpty(codeFallback))
                        {
                            schemaType = codeFallback;
                        }
                    }
                }

                // Assemble transformed recipe entry with normalized fields and fallbacks
                var entryObj = new System.Collections.Generic.Dictionary<string, object?>
                {
                    ["Level"] = level,
                    ["Id"] = r.Id,
                    ["Products"] = products,
                    ["Time"] = (double)r.Time,
                    ["Ingredients"] = ingredients,
                    ["GroupId"] = groupIdValue,
                    ["NqId"] = r.Id,
                    ["UnitMass"] = TryGetUnitMass(def) ?? 0.0,
                    ["UnitVolume"] = TryGetUnitVolume(def) ?? 0.0,
                    ["Nanocraftable"] = r.Nanocraftable,
                    ["Size"] = size,
                    ["Industry"] = industryName,
                    ["Name"] = productName,
                    ["ParentGroupName"] = parentGroupName
                };
                if (!IsDescendantOfPart(outType))
                {
                    entryObj["SchemaType"] = schemaType;
                    entryObj["SchemaPrice"] = schemaPrice;
                }
                result[outType] = entryObj;
            }
            return Task.FromResult(result);
        }

        private static string BuildNameWithSize(string typeKey, IGameplayBank bank)
        {
            string name;
            if (MyDuData.NameMap != null && MyDuData.NameMap.TryGetValue(typeKey, out var mapped))
            {
                name = mapped;
            }
            else
            {
                var def = bank.GetDefinition(typeKey);
                name = def != null ? def.Name : typeKey;
            }
            string size = string.Empty;
            if (MyDuData.DocMap.TryGetValue(typeKey, out var doc))
            {
                var rawScale = doc.Property("scale")?.Value?.ToString();
                size = NormalizeSize(rawScale);
            }
            if (string.IsNullOrEmpty(size))
            {
                size = InferSizeFrom(typeKey, name);
            }
            var sizeLower = string.IsNullOrEmpty(size) ? string.Empty : size.ToLowerInvariant();
            return string.IsNullOrEmpty(sizeLower) ? name : name + " " + sizeLower;
        }

        /// <summary>
        /// Returns true if the item's ancestry contains a root category that requires schematics.
        /// Root categories considered: Consumables, Elements, Materials.
        /// </summary>
        private bool IsInSchematicRootCategory(string typeKey)
        {
            if (string.IsNullOrEmpty(typeKey))
            {
                return false;
            }
            if (MyDuData.ParentMap.TryGetValue(typeKey, out var gi))
            {
                return gi.SchematicRequired;
            }
            return false;
        }

        private static string DeriveSchematicKey(string outType, string size, int level)
        {
            if (string.IsNullOrEmpty(outType)) return null;
            var mAsm = Regex.Match(outType, @"(xxxl|xxl|xl|xs|s|m|l)$", RegexOptions.IgnoreCase);
            var sz = !string.IsNullOrEmpty(size) ? size.ToUpperInvariant() : (mAsm.Success ? mAsm.Groups[1].Value.ToUpperInvariant() : string.Empty);
            if (Regex.IsMatch(outType, @"CoreUnit", RegexOptions.IgnoreCase)) return string.IsNullOrEmpty(sz) ? "CU" : "CU-" + sz;
            if (Regex.IsMatch(outType, @"ConstructSupport", RegexOptions.IgnoreCase)) return string.IsNullOrEmpty(sz) ? "CS" : "CS-" + sz;
            if (Regex.IsMatch(outType, @"Bonsai", RegexOptions.IgnoreCase)) return "Bonsai";
            if (Regex.IsMatch(outType, @"WarpCell", RegexOptions.IgnoreCase)) return "WarpCell";
            if (Regex.IsMatch(outType, @"WarpBeacon", RegexOptions.IgnoreCase)) return "WarpBeacon";
            if (Regex.IsMatch(outType, @"TerritoryUnit", RegexOptions.IgnoreCase)) return "TerritoryUnit";
            if (Regex.IsMatch(outType, @"AtmoFuel", RegexOptions.IgnoreCase)) return "AtmoFuel";
            if (Regex.IsMatch(outType, @"SpaceFuel", RegexOptions.IgnoreCase)) return "SpaceFuels";
            if (Regex.IsMatch(outType, @"RocketFuel", RegexOptions.IgnoreCase)) return "RocketFuels";
            if (Regex.IsMatch(outType, @"PureHoneycomb", RegexOptions.IgnoreCase)) return "T" + Math.Max(2, level) + "HU";
            if (Regex.IsMatch(outType, @"Honeycomb", RegexOptions.IgnoreCase)) return "T" + Math.Max(1, level) + "HP";
            if (Regex.IsMatch(outType, @"Scrap", RegexOptions.IgnoreCase)) return "T" + Math.Max(1, level) + "SC";
            if (Regex.IsMatch(outType, @"Ammo", RegexOptions.IgnoreCase)) return ("T" + Math.Max(1, level) + "A" + (string.IsNullOrEmpty(sz) ? string.Empty : sz));
            if (Regex.IsMatch(outType, @"(Pure|Product)Material", RegexOptions.IgnoreCase))
            {
                if (Regex.IsMatch(outType, @"^Pure", RegexOptions.IgnoreCase)) return "T" + Math.Max(1, level) + "U";
                return "T" + Math.Max(1, level) + "P";
            }
            if (Regex.IsMatch(outType, @"Element", RegexOptions.IgnoreCase)) return ("T" + Math.Max(1, level) + "E" + (string.IsNullOrEmpty(sz) ? string.Empty : sz));
            return null;
        }

        private static bool IsDescendantOfPart(string typeKey)
        {
            if (string.IsNullOrEmpty(typeKey)) return false;
            string cur = typeKey;
            int guard = 0;
            var visited = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            while (!string.IsNullOrEmpty(cur) && guard++ < 5 && visited.Add(cur))
            {
                if (!MyDuData.DocMap.TryGetValue(cur, out var doc)) break;
                var parent = doc.Property("parent")?.Value?.ToString();
                if (string.IsNullOrEmpty(parent)) break;
                if (string.Equals(parent, "Part", StringComparison.Ordinal)) return true;
                cur = parent;
            }
            return false;
        }

        /// <summary>
        /// Extracts a single-line scalar value from a YAML text by key.
        /// </summary>
        /// <param name="yaml">YAML text.</param>
        /// <param name="key">Key to search.</param>
        private static string ExtractScalar(string yaml, string key)
        {
            if (string.IsNullOrEmpty(yaml) || string.IsNullOrEmpty(key))
            {
                return string.Empty;
            }
            var rx = new Regex("^\\s*" + Regex.Escape(key) + ":\\s*(.+)$", RegexOptions.Multiline);
            var m = rx.Match(yaml);
            if (!m.Success)
            {
                return string.Empty;
            }
            var val = m.Groups[1].Value.Trim();
            if (val.StartsWith("\"") && val.EndsWith("\""))
            {
                val = val.Substring(1, val.Length - 2);
            }
            return val;
        }

        /// <summary>
        /// Attempts to read unitMass from a gameplay definition.
        /// </summary>
        /// <param name="def">Gameplay definition.</param>
        private static double? TryGetUnitMass(object def)
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

        /// <summary>
        /// Attempts to read unitVolume from a gameplay definition.
        /// </summary>
        /// <param name="def">Gameplay definition.</param>
        private static double? TryGetUnitVolume(object def)
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

        /// <summary>
        /// Attempts to read level/Tier from a gameplay definition.
        /// </summary>
        /// <param name="def">Gameplay definition.</param>
        private static int TryParseTier(object def)
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

        /// <summary>
        /// Infers level from recipe input keys suffix pattern.
        /// </summary>
        /// <param name="r">Recipe.</param>
        private static int? InferLevelFromInputs(Backend.SRecipe r)
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

        /// <summary>
        /// Maps industry codes to human-readable display text.
        /// </summary>
        /// <param name="industry">Industry code.</param>
        /// <param name="size">Size code.</param>
        private static string MapIndustryToDisplay(string industry, string size)
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

        /// <summary>
        /// Infers size suffix from type name or display name.
        /// </summary>
        /// <param name="typeName">Type key.</param>
        /// <param name="itemName">Display name.</param>
        private static string InferSizeFrom(string typeName, string itemName)
        {
            if (!string.IsNullOrEmpty(typeName))
            {
                if (Regex.IsMatch(typeName, @"^ContainerSmall", RegexOptions.IgnoreCase)) return "xs";
                if (Regex.IsMatch(typeName, @"^ContainerMedium", RegexOptions.IgnoreCase)) return "s";
                if (Regex.IsMatch(typeName, @"^ContainerLarge", RegexOptions.IgnoreCase)) return "m";
                if (Regex.IsMatch(typeName, @"^ContainerXL", RegexOptions.IgnoreCase)) return "l";
                if (Regex.IsMatch(typeName, @"^ContainerXXL", RegexOptions.IgnoreCase)) return "xl";
                if (Regex.IsMatch(typeName, @"^ContainerXXXL", RegexOptions.IgnoreCase)) return "xxl";
            }
            var mType = Regex.Match(typeName, @"(xxxl|xxl|xl|xs|s|m|l)$", RegexOptions.IgnoreCase);
            if (mType.Success) return mType.Groups[1].Value;
            var mName = Regex.Match(itemName, @"\s(xxxl|xxl|xl|xs|s|m|l)$", RegexOptions.IgnoreCase);
            if (mName.Success) return mName.Groups[1].Value;
            return string.Empty;
        }

        private static string NormalizeSize(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return string.Empty;
            var s = raw.Trim();
            if (s.Equals("XtraSmall", StringComparison.OrdinalIgnoreCase)) return "xs";
            if (s.Equals("ExtraSmall", StringComparison.OrdinalIgnoreCase)) return "xs";
            if (s.Equals("Small", StringComparison.OrdinalIgnoreCase)) return "s";
            if (s.Equals("Medium", StringComparison.OrdinalIgnoreCase)) return "m";
            if (s.Equals("Large", StringComparison.OrdinalIgnoreCase)) return "l";
            if (s.Equals("ExtraLarge", StringComparison.OrdinalIgnoreCase)) return "xl";
            if (s.Equals("XXLarge", StringComparison.OrdinalIgnoreCase) || s.Equals("ExtraExtraLarge", StringComparison.OrdinalIgnoreCase)) return "xxl";
            if (s.Equals("XXXLarge", StringComparison.OrdinalIgnoreCase) || s.Equals("ExtraExtraExtraLarge", StringComparison.OrdinalIgnoreCase)) return "xxxl";
            var m = Regex.Match(s, @"^(xxxl|xxl|xl|xs|s|m|l)$", RegexOptions.IgnoreCase);
            if (m.Success) return m.Groups[1].Value.ToLowerInvariant();
            return s.ToLowerInvariant();
        }

        /// <summary>
        /// Checks selected required properties against an item object.
        /// </summary>
        /// <param name="itemObj">Item JSON object.</param>
        private bool ItemHasRequiredProps(JObject itemObj)
        {
            if (chkPropDisplayName.Checked && itemObj.Property("displayName") == null) return false;
            if (chkPropUnitVolume.Checked)
            {
                bool hasUnitVolume = itemObj.Property("unitVolume") != null;
                bool hasMaxVolume = itemObj.Property("maxVolume") != null;
                if (!hasUnitVolume && !hasMaxVolume)
                {
                    return false;
                }
            }
            if (chkPropUnitMass.Checked && itemObj.Property("unitMass") == null) return false;
            if (chkPropScale.Checked && itemObj.Property("scale") == null && itemObj.Property("Size") == null) return false;
            if (chkPropLevel.Checked && itemObj.Property("level") == null && itemObj.Property("Tier") == null) return false;
            if (chkPropSubdescription.Checked && itemObj.Property("subdescription") == null) return false;
            if (chkPropHitpoints.Checked && itemObj.Property("hitpoints") == null) return false;
            if (chkPropRequiredTalentsForUse.Checked && itemObj.Property("requiredTalentsForUse") == null) return false;
            return true;
        }

        /// <summary>
        /// Shows a save file dialog, seeded with a suggested path.
        /// </summary>
        /// <param name="suggestedPath">Suggested starting path.</param>
        /// <param name="filter">Dialog filter string.</param>
        /// <param name="defaultExt">Default extension.</param>
        private string? PromptSavePath(string suggestedPath, string filter, string defaultExt)
        {
            // Auto-overwrite mode: bypass dialog and save to app folder with default filename
            try
            {
                if (chkAutoOverwrite != null && chkAutoOverwrite.Checked)
                {
                    var baseDir = AppContext.BaseDirectory;
                    var fileName = Path.GetFileName(suggestedPath);
                    if (string.IsNullOrWhiteSpace(fileName))
                    {
                        var ext = string.IsNullOrWhiteSpace(defaultExt) ? string.Empty : (defaultExt.StartsWith(".") ? defaultExt : "." + defaultExt);
                        fileName = "export" + ext;
                    }
                    else if (string.IsNullOrWhiteSpace(Path.GetExtension(fileName)) && !string.IsNullOrWhiteSpace(defaultExt))
                    {
                        var ext = defaultExt.StartsWith(".") ? defaultExt : "." + defaultExt;
                        fileName += ext;
                    }
                    var outPath = Path.Combine(baseDir, fileName);
                    Directory.CreateDirectory(Path.GetDirectoryName(outPath) ?? ".");
                    return outPath;
                }
            }
            catch { }

            using (var dlg = new SaveFileDialog())
            {
                dlg.Filter = filter;
                dlg.DefaultExt = defaultExt;
                dlg.AddExtension = true;
                dlg.InitialDirectory = Path.GetDirectoryName(suggestedPath) ?? ".";
                dlg.FileName = Path.GetFileName(suggestedPath);
                var result = dlg.ShowDialog(this);
                if (result == DialogResult.OK)
                    return dlg.FileName;
                throw new OperationCanceledException("Export canceled by user.");
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            MyDuController.DisposeServices();
            base.OnFormClosed(e);
        }

        /// <summary>
        /// Enables/disables Talents and Schematics export options with YAML toggle.
        /// </summary>
        /// <param name="sender">Event source.</param>
        /// <param name="e">Event arguments.</param>
        private void chkExportYaml_CheckedChanged(object sender, EventArgs e)
        {
            chkExportTalents.Enabled = chkExportYaml.Checked;
            chkExportTalentsJson.Enabled = chkExportYaml.Checked;
            chkExportSchematics.Enabled = chkExportYaml.Checked;
            chkExportSchematicsJson.Enabled = chkExportYaml.Checked;
        }
    }
}
