using System;
using System.Linq;
using System.Globalization;
using System.Collections.Generic;
using System.Threading.Tasks;
using Backend;
using NQ;
using NQ.Interfaces;
using NQutils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

sealed class ConstructInspectionContext
{
    public ulong PlayerId { get; set; }
    public ConstructId ConstructId { get; set; }
    public bool UsedCurrentConstruct { get; set; }
    public string ConstructName { get; set; } = "";
    public EntityId OwnerId { get; set; } = new EntityId();
    public IGameplayBank GameplayBank { get; set; } = null!;
    public List<ElementInfo> Elements { get; set; } = new List<ElementInfo>();
    public Dictionary<ulong, ElementInfo> ElementsById { get; set; } = new Dictionary<ulong, ElementInfo>();
}

public sealed partial class MyDuMod
{
    private async Task<bool> TryProcessConstructInspectorBridgeCommand(
        string commandId,
        string targetKind,
        string action,
        JObject payload,
        ulong playerId,
        string? boardId)
    {
        if (!string.Equals(targetKind, "construct_inspector", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.Equals(action, "probe_call", StringComparison.OrdinalIgnoreCase))
        {
            await AppendMcpBridgeEvent(
                "construct_inspector",
                "command_result",
                playerId,
                new JObject
                {
                    ["commandId"] = commandId,
                    ["status"] = "rejected",
                    ["reason"] = "unsupported_action",
                    ["action"] = action
                },
                boardId);
            return true;
        }

        var probeMethod = payload["probeMethod"]?.Value<string>()?.Trim() ?? "";
        var resultPayload = await BuildConstructInspectorPayload(commandId, playerId, probeMethod, payload);
        await AppendMcpBridgeEvent("construct_inspector", "construct_inspector_result", playerId, resultPayload, boardId);

        var success = resultPayload["success"]?.Value<bool>() ?? false;
        var error = resultPayload["error"]?.Value<string>();
        await AppendMcpBridgeEvent(
            "construct_inspector",
            "command_result",
            playerId,
            new JObject
            {
                ["commandId"] = commandId,
                ["status"] = success ? "completed" : "rejected",
                ["action"] = action,
                ["summary"] = "construct_inspector " + probeMethod,
                ["probeMethod"] = probeMethod,
                ["reason"] = error is null ? JValue.CreateNull() : error
            },
            boardId);

        return true;
    }

    private async Task<JObject> BuildConstructInspectorPayload(string commandId, ulong playerId, string probeMethod, JObject payload)
    {
        try
        {
            switch ((probeMethod ?? "").Trim().ToLowerInvariant())
            {
                case "describe":
                    return await BuildConstructDescribePayload(commandId, playerId, payload);
                case "find_elements":
                    return await BuildConstructFindElementsPayload(commandId, playerId, payload);
                case "inspect_element":
                    return await BuildConstructInspectElementPayload(commandId, playerId, payload);
                case "analyze_patterns":
                    return await BuildConstructAnalyzePatternsPayload(commandId, playerId, payload);
                default:
                    return CreateConstructInspectorFailure(commandId, probeMethod, "unsupported_probe_method");
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIToolbox construct inspector failed for method {ProbeMethod}", probeMethod);
            return CreateConstructInspectorFailure(commandId, probeMethod, ex.Message);
        }
    }

    private async Task<JObject> BuildConstructDescribePayload(string commandId, ulong playerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var (constructId, usedCurrentConstruct) = await ResolveConstructIdForInspection(playerId, probeArgs, 0);
        var context = await LoadConstructInspectionContext(playerId, constructId, usedCurrentConstruct);
        var distinctLinks = EnumerateDistinctConstructLinks(context.Elements).ToList();

        var categoryCounts = context.Elements
            .GroupBy(element => ResolveElementCategory(context, element), StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key, StringComparer.OrdinalIgnoreCase);
        var typeCounts = context.Elements
            .GroupBy(
                element => new
                {
                    Category = ResolveElementCategory(context, element),
                    TypeName = ResolveElementTypeName(context, element),
                    ElementTypeId = element.elementType
                })
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key.TypeName, StringComparer.OrdinalIgnoreCase)
            .Take(64);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "describe",
            ["construct"] = BuildConstructDescriptor(context),
            ["elementCount"] = context.Elements.Count,
            ["linkCount"] = distinctLinks.Count,
            ["categoryCounts"] = new JArray(
                categoryCounts.Select(group => new JObject
                {
                    ["category"] = group.Key,
                    ["count"] = group.Count()
                })),
            ["typeCounts"] = new JArray(
                typeCounts.Select(group => new JObject
                {
                    ["category"] = group.Key.Category,
                    ["typeName"] = group.Key.TypeName,
                    ["elementTypeId"] = group.Key.ElementTypeId,
                    ["count"] = group.Count()
                }))
        };
    }

    private async Task<JObject> BuildConstructFindElementsPayload(string commandId, ulong playerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var query = ReadProbeArgString(probeArgs, 0) ?? "";
        var (constructId, usedCurrentConstruct) = await ResolveConstructIdForInspection(playerId, probeArgs, 1);
        var limit = ReadClampedProbeArgInt32(probeArgs, 2, 50, 1, 250);
        var normalizedQuery = NormalizeSearchText(query);
        var context = await LoadConstructInspectionContext(playerId, constructId, usedCurrentConstruct);

        var matches = context.Elements
            .Select(element =>
            {
                var customName = TryReadElementCustomName(element) ?? "";
                var typeName = ResolveElementTypeName(context, element);
                var category = ResolveElementCategory(context, element);
                var searchable = string.Join(
                    " ",
                    new[]
                    {
                        customName,
                        typeName,
                        category,
                        element.elementId.ToString(CultureInfo.InvariantCulture),
                        element.localId.ToString(CultureInfo.InvariantCulture)
                    });
                return new
                {
                    Element = element,
                    Searchable = searchable,
                    CustomName = customName,
                    TypeName = typeName
                };
            })
            .Where(entry => normalizedQuery.Length == 0 || entry.Searchable.IndexOf(normalizedQuery, StringComparison.OrdinalIgnoreCase) >= 0)
            .OrderByDescending(entry => normalizedQuery.Length > 0 && entry.CustomName.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(entry => normalizedQuery.Length > 0 && entry.TypeName.StartsWith(normalizedQuery, StringComparison.OrdinalIgnoreCase))
            .ThenBy(entry => entry.TypeName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.Element.localId)
            .ToList();

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "find_elements",
            ["construct"] = BuildConstructDescriptor(context),
            ["query"] = query,
            ["limit"] = limit,
            ["totalMatches"] = matches.Count,
            ["matches"] = new JArray(matches.Take(limit).Select(match => BuildElementSummary(context, match.Element)))
        };
    }

    private async Task<JObject> BuildConstructInspectElementPayload(string commandId, ulong playerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var requestedId = ReadProbeArgUInt64(probeArgs, 0);
        if (!requestedId.HasValue || requestedId.Value == 0)
        {
            return CreateConstructInspectorFailure(commandId, "inspect_element", "missing_id");
        }

        var (constructId, usedCurrentConstruct) = await ResolveConstructIdForInspection(playerId, probeArgs, 1);
        var context = await LoadConstructInspectionContext(playerId, constructId, usedCurrentConstruct);
        var element = context.ElementsById.Values.FirstOrDefault(candidate => candidate.localId == requestedId.Value);
        if (element == null)
        {
            return CreateConstructInspectorFailure(commandId, "inspect_element", "element_not_found");
        }

        var category = ResolveElementCategory(context, element);
        var inboundLinks = EnumerateDistinctElementLinks(element, link => link.toElementId == element.elementId)
            .Select(link => BuildLinkSummary(context, link, element));
        var outboundLinks = EnumerateDistinctElementLinks(element, link => link.fromElementId == element.elementId)
            .Select(link => BuildLinkSummary(context, link, element));

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "inspect_element",
            ["construct"] = BuildConstructDescriptor(context),
            ["element"] = BuildElementSummary(context, element),
            ["inboundLinks"] = new JArray(inboundLinks),
            ["outboundLinks"] = new JArray(outboundLinks),
            ["industryRuntime"] = SupportsIndustryRuntime(category)
                ? await TryBuildIndustryRuntimePayload(element)
                : JValue.CreateNull(),
            ["storageRuntime"] = SupportsStorageRuntime(category)
                ? await TryBuildStorageRuntimePayload(playerId, element, category)
                : JValue.CreateNull()
        };
    }

    private async Task<JObject> BuildConstructAnalyzePatternsPayload(string commandId, ulong playerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var (constructId, usedCurrentConstruct) = await ResolveConstructIdForInspection(playerId, probeArgs, 0);
        var limit = ReadClampedProbeArgInt32(probeArgs, 1, 25, 1, 100);
        var context = await LoadConstructInspectionContext(playerId, constructId, usedCurrentConstruct);

        var patternGroups = context.Elements
            .Select(element =>
            {
                var pattern = BuildElementPatternSignature(context, element);
                return new
                {
                    Element = element,
                    pattern.Signature,
                    pattern.Descriptor
                };
            })
            .Where(entry => entry.Signature.Length > 0)
            .GroupBy(entry => entry.Signature, StringComparer.Ordinal)
            .Where(group => group.Count() > 1)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key, StringComparer.Ordinal)
            .Take(limit)
            .Select(group =>
            {
                var first = group.First();
                return new JObject
                {
                    ["count"] = group.Count(),
                    ["descriptor"] = first.Descriptor,
                    ["exampleElements"] = new JArray(group.Take(20).Select(entry => BuildElementSummary(context, entry.Element)))
                };
            });

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "analyze_patterns",
            ["construct"] = BuildConstructDescriptor(context),
            ["limit"] = limit,
            ["patterns"] = new JArray(patternGroups)
        };
    }

    private async Task<ConstructInspectionContext> LoadConstructInspectionContext(ulong playerId, ConstructId constructId, bool usedCurrentConstruct)
    {
        var bank = services.GetRequiredService<IGameplayBank>();
        var targeting = await TryReadTargetingConstructData(constructId);
        var elementList = await orleans.GetConstructElementsGrain(constructId).GetVisibleAt(0);
        var elements = elementList?.elements ?? new List<ElementInfo>();
        var elementsById = elements
            .GroupBy(element => element.elementId)
            .ToDictionary(group => group.Key, group => group.First());

        return new ConstructInspectionContext
        {
            PlayerId = playerId,
            ConstructId = constructId,
            UsedCurrentConstruct = usedCurrentConstruct,
            ConstructName = targeting?.constructName ?? constructId.ToString(),
            OwnerId = targeting?.ownerId ?? new EntityId(),
            GameplayBank = bank,
            Elements = elements,
            ElementsById = elementsById
        };
    }

    private async Task<(ConstructId ConstructId, bool UsedCurrentConstruct)> ResolveConstructIdForInspection(ulong playerId, JArray? probeArgs, int constructIdArgIndex)
    {
        var requestedConstructId = ReadProbeArgUInt64(probeArgs, constructIdArgIndex);
        if (requestedConstructId.HasValue && requestedConstructId.Value > 0)
        {
            return ((ConstructId)requestedConstructId.Value, false);
        }

        var playerPosition = await orleans.GetPlayerGrain((PlayerId)playerId).GetPositionUpdate();
        var currentConstructId = playerPosition?.localPosition?.constructId ?? 0UL;
        if (currentConstructId == 0)
        {
            throw new InvalidOperationException("player_not_in_construct");
        }

        return ((ConstructId)currentConstructId, true);
    }

    private async Task<TargetingConstructData?> TryReadTargetingConstructData(ConstructId constructId)
    {
        try
        {
            return await orleans.GetConstructGrain(constructId).GetTargetingConstructData();
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIToolbox construct inspector could not read targeting data for construct {ConstructId}", (ulong)constructId);
            return null;
        }
    }

    private static JObject CreateConstructInspectorFailure(string commandId, string probeMethod, string error)
    {
        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = false,
            ["error"] = error,
            ["method"] = probeMethod
        };
    }

    private static ulong? ReadProbeArgUInt64(JArray? probeArgs, int index)
    {
        if (probeArgs is null || index < 0 || index >= probeArgs.Count)
        {
            return null;
        }

        var token = probeArgs[index];
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return null;
        }

        if (token.Type == JTokenType.Integer)
        {
            return token.Value<ulong>();
        }

        var raw = token.Value<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        return ulong.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }

    private static int ReadClampedProbeArgInt32(JArray? probeArgs, int index, int fallback, int minValue, int maxValue)
    {
        if (probeArgs is null || index < 0 || index >= probeArgs.Count)
        {
            return fallback;
        }

        var token = probeArgs[index];
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return fallback;
        }

        var raw = token.Type == JTokenType.Integer
            ? token.Value<long>().ToString(CultureInfo.InvariantCulture)
            : token.Value<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(raw) ||
            !int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
        {
            return fallback;
        }

        return Math.Max(minValue, Math.Min(maxValue, value));
    }

    private static string? ReadProbeArgString(JArray? probeArgs, int index)
    {
        if (probeArgs is null || index < 0 || index >= probeArgs.Count)
        {
            return null;
        }

        var token = probeArgs[index];
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return null;
        }

        return token.Type == JTokenType.String
            ? token.Value<string>()
            : Convert.ToString(token, CultureInfo.InvariantCulture);
    }

    private static string NormalizeSearchText(string? value)
    {
        return (value ?? "").Trim();
    }

    private static JObject BuildConstructDescriptor(ConstructInspectionContext context)
    {
        return new JObject
        {
            ["constructId"] = (ulong)context.ConstructId,
            ["constructName"] = context.ConstructName,
            ["owner"] = BuildOwnerObject(context.OwnerId),
            ["usedCurrentConstruct"] = context.UsedCurrentConstruct
        };
    }

    private JObject BuildElementSummary(ConstructInspectionContext context, ElementInfo element)
    {
        var category = ResolveElementCategory(context, element);
        var typeName = ResolveElementTypeName(context, element);
        var customName = TryReadElementCustomName(element);
        var inboundLinkCount = EnumerateDistinctElementLinks(element, link => link.toElementId == element.elementId).Count();
        var outboundLinkCount = EnumerateDistinctElementLinks(element, link => link.fromElementId == element.elementId).Count();

        return new JObject
        {
            ["elementId"] = element.elementId,
            ["localId"] = element.localId,
            ["elementTypeId"] = element.elementType,
            ["typeName"] = typeName,
            ["category"] = category,
            ["customName"] = string.IsNullOrWhiteSpace(customName) ? JValue.CreateNull() : customName,
            ["label"] = string.IsNullOrWhiteSpace(customName)
                ? $"{typeName} [{element.localId}]"
                : customName,
            ["position"] = BuildVec3Object(element.position),
            ["incomingLinkCount"] = inboundLinkCount,
            ["outgoingLinkCount"] = outboundLinkCount
        };
    }

    private JObject BuildLinkSummary(ConstructInspectionContext context, LinkInfo link, ElementInfo focusElement)
    {
        var focusIsFrom = link.fromElementId == focusElement.elementId;
        var peerId = focusIsFrom ? link.toElementId : link.fromElementId;
        var peer = context.ElementsById.TryGetValue(peerId, out var peerElement)
            ? peerElement
            : new ElementInfo
            {
                elementId = peerId,
                constructId = (ulong)context.ConstructId
            };

        return new JObject
        {
            ["direction"] = focusIsFrom ? "outbound" : "inbound",
            ["plugType"] = link.plugType.ToString(),
            ["fromPlug"] = link.fromPlug,
            ["toPlug"] = link.toPlug,
            ["peer"] = BuildElementSummary(context, peer)
        };
    }

    private async Task<JObject> TryBuildIndustryRuntimePayload(ElementInfo element)
    {
        try
        {
            var status = await orleans.GetIndustryUnitGrain(element.elementId).Status();
            var countersUsable = status.state == IndustryState.RUNNING;
            var primaryProduct = status.recipe?.products?.FirstOrDefault();
            var primaryProductItemTypeId = primaryProduct?.itemId ?? 0;
            return new JObject
            {
                ["available"] = true,
                ["state"] = status.state.ToString(),
                ["countersUsable"] = countersUsable,
                ["stopRequested"] = status.stopRequested,
                ["recipeId"] = status.recipeId,
                ["nextRecipeId"] = status.nextRecipeId,
                ["unitsProduced"] = status.unitsProduced,
                ["remainingTime"] = countersUsable ? new JValue(status.remainingTime) : JValue.CreateNull(),
                ["batchesRemaining"] = countersUsable ? new JValue(status.batchesRemaining) : JValue.CreateNull(),
                ["maintainProductAmount"] = status.maintainProductAmount,
                ["currentProductAmount"] = status.currentProductAmount,
                ["productItemTypeId"] = primaryProductItemTypeId == 0 ? JValue.CreateNull() : new JValue(primaryProductItemTypeId),
                ["productItemName"] = primaryProductItemTypeId == 0 ? JValue.CreateNull() : ResolveItemTypeName(0, primaryProductItemTypeId),
                ["maintainQuantity"] = primaryProductItemTypeId == 0
                    ? JValue.CreateNull()
                    : new JValue(ConvertRawQuantityToDisplay(primaryProductItemTypeId, (long)status.maintainProductAmount)),
                ["currentQuantity"] = primaryProductItemTypeId == 0
                    ? JValue.CreateNull()
                    : new JValue(ConvertRawQuantityToDisplay(primaryProductItemTypeId, (long)status.currentProductAmount)),
                ["batchesRequested"] = status.batchesRequested,
                ["claimProducts"] = status.claimProducts,
                ["recipe"] = BuildIndustryRuntimeRecipeObject(status.recipe)
            };
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIToolbox construct inspector failed to read industry status for element {ElementId}", element.elementId);
            return new JObject
            {
                ["available"] = false,
                ["error"] = ex.Message
            };
        }
    }

    private async Task<JObject> TryBuildStorageRuntimePayload(ulong playerId, ElementInfo element, string category)
    {
        try
        {
            var storage = await orleans.GetContainerGrain((ElementId)element.elementId).Get((PlayerId)playerId);
            return BuildStorageSnapshot(storage, category);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "UIToolbox construct inspector failed to read storage for element {ElementId}", element.elementId);
            return new JObject
            {
                ["available"] = false,
                ["category"] = category,
                ["error"] = ex.Message
            };
        }
    }

    private JObject BuildStorageSnapshot(StorageInfo storage, string category)
    {
        var items = storage.content
            .Where(slot => slot.quantity.value > 0)
            .OrderByDescending(slot => slot.quantity.value)
            .ThenBy(slot => slot.position)
            .Take(20)
            .Select(slot =>
            {
                var itemName = ResolveItemTypeName(storage.containerId, slot.content.type);
                return new JObject
                {
                    ["slot"] = slot.position,
                    ["itemTypeId"] = slot.content.type,
                    ["itemName"] = itemName,
                    ["itemId"] = slot.content.id,
                    ["quantity"] = slot.quantity.value
                };
            });

        return new JObject
        {
            ["available"] = true,
            ["category"] = category,
            ["containerId"] = storage.containerId,
            ["volume"] = storage.volume,
            ["maxVolume"] = storage.maxVolume,
            ["mass"] = storage.mass,
            ["itemFilterId"] = storage.itemFilterId,
            ["claimMode"] = storage.claimMode.ToString(),
            ["occupiedSlots"] = storage.content.Count(slot => slot.quantity.value > 0),
            ["uniqueItemTypes"] = storage.content
                .Where(slot => slot.quantity.value > 0)
                .Select(slot => slot.content.type)
                .Distinct()
                .Count(),
            ["items"] = new JArray(items)
        };
    }

    private (string Signature, JObject Descriptor) BuildElementPatternSignature(ConstructInspectionContext context, ElementInfo element)
    {
        var category = ResolveElementCategory(context, element);
        if (string.Equals(category, "other", StringComparison.OrdinalIgnoreCase))
        {
            return ("", new JObject());
        }

        var typeName = ResolveElementTypeName(context, element);
        var inbound = EnumerateDistinctElementLinks(element, link => link.toElementId == element.elementId)
            .Select(link => DescribeNeighborForPattern(context, link.fromElementId, link.plugType))
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToList();
        var outbound = EnumerateDistinctElementLinks(element, link => link.fromElementId == element.elementId)
            .Select(link => DescribeNeighborForPattern(context, link.toElementId, link.plugType))
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToList();

        if (inbound.Count == 0 && outbound.Count == 0)
        {
            return ("", new JObject());
        }

        var descriptor = new JObject
        {
            ["category"] = category,
            ["typeName"] = typeName,
            ["incoming"] = new JArray(inbound),
            ["outgoing"] = new JArray(outbound)
        };
        var signature = category
            + "|"
            + typeName
            + "|in:"
            + string.Join(",", inbound)
            + "|out:"
            + string.Join(",", outbound);
        return (signature, descriptor);
    }

    private string DescribeNeighborForPattern(ConstructInspectionContext context, ulong elementId, PlugType plugType)
    {
        if (!context.ElementsById.TryGetValue(elementId, out var element))
        {
            return plugType + ":missing";
        }

        return plugType
            + ":"
            + ResolveElementCategory(context, element)
            + ":"
            + ResolveElementTypeName(context, element);
    }

    private static IEnumerable<LinkInfo> EnumerateDistinctElementLinks(ElementInfo element, Func<LinkInfo, bool> predicate)
    {
        if (element.links is null || element.links.Count == 0)
        {
            return Enumerable.Empty<LinkInfo>();
        }

        var result = new Dictionary<string, LinkInfo>(StringComparer.Ordinal);
        foreach (var link in element.links)
        {
            if (!predicate(link))
            {
                continue;
            }

            result[BuildLinkKey(link)] = link;
        }

        return result.Values;
    }

    private static IEnumerable<LinkInfo> EnumerateDistinctConstructLinks(IEnumerable<ElementInfo> elements)
    {
        var result = new Dictionary<string, LinkInfo>(StringComparer.Ordinal);
        foreach (var element in elements)
        {
            if (element.links is null)
            {
                continue;
            }

            foreach (var link in element.links)
            {
                result[BuildLinkKey(link)] = link;
            }
        }

        return result.Values;
    }

    private static string BuildLinkKey(LinkInfo link)
    {
        return string.Join(
            ":",
            link.constructId.ToString(CultureInfo.InvariantCulture),
            link.fromElementId.ToString(CultureInfo.InvariantCulture),
            link.fromPlug.ToString(CultureInfo.InvariantCulture),
            link.toElementId.ToString(CultureInfo.InvariantCulture),
            link.toPlug.ToString(CultureInfo.InvariantCulture),
            link.plugType.ToString());
    }

    private string ResolveElementTypeName(ConstructInspectionContext context, ElementInfo element)
    {
        var definition = context.GameplayBank.GetDefinition(element.elementType);
        return definition?.Name ?? ("type:" + element.elementType.ToString(CultureInfo.InvariantCulture));
    }

    private string ResolveItemTypeName(ulong containerId, ulong itemTypeId)
    {
        var bank = services.GetRequiredService<IGameplayBank>();
        var definition = bank.GetDefinition(itemTypeId);
        return definition?.Name ?? ("item:" + itemTypeId.ToString(CultureInfo.InvariantCulture));
    }

    private string ResolveElementCategory(ConstructInspectionContext context, ElementInfo element)
    {
        var definition = context.GameplayBank.GetDefinition(element.elementType);
        if (definition is null)
        {
            return "other";
        }

        if (definition.Is<NQutils.Def.IndustryUnit>())
        {
            return "industry";
        }

        if (definition.Is<NQutils.Def.ContainerHub>())
        {
            return "container_hub";
        }

        if (definition.Is<NQutils.Def.ItemContainer>())
        {
            return "container";
        }

        if (definition.Is<NQutils.Def.TransferUnit>())
        {
            return "transfer";
        }

        if (definition.Is<NQutils.Def.MiningUnit>())
        {
            return "mining";
        }

        if (definition.Is<NQutils.Def.PlasmaExtractorUnit>())
        {
            return "plasma_extractor";
        }

        return "other";
    }

    private static bool SupportsIndustryRuntime(string category)
    {
        return string.Equals(category, "industry", StringComparison.OrdinalIgnoreCase);
    }

    private static bool SupportsStorageRuntime(string category)
    {
        return string.Equals(category, "container", StringComparison.OrdinalIgnoreCase)
            || string.Equals(category, "container_hub", StringComparison.OrdinalIgnoreCase);
    }

    private static string? TryReadElementCustomName(ElementInfo element)
    {
        if (element.properties is null || element.properties.Count == 0)
        {
            return null;
        }

        foreach (var key in new[] { "name", "displayName", "customName" })
        {
            if (element.properties.TryGetValue(key, out var propertyValue) && !string.IsNullOrWhiteSpace(propertyValue.stringOpt))
            {
                return propertyValue.stringOpt!.Trim();
            }
        }

        return null;
    }

    private static JObject BuildVec3Object(Vec3 value)
    {
        return new JObject
        {
            ["x"] = value.x,
            ["y"] = value.y,
            ["z"] = value.z
        };
    }

    private static JObject BuildOwnerObject(EntityId ownerId)
    {
        return new JObject
        {
            ["playerId"] = ownerId.playerId,
            ["organizationId"] = ownerId.organizationId,
            ["kind"] = ownerId.IsPlayer()
                ? "player"
                : ownerId.IsOrg()
                    ? "organization"
                    : "none"
        };
    }
}
