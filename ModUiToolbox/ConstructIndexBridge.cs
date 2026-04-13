using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using Backend;
using Backend.Storage;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;
using NQ;
using NQ.Interfaces;
using NQutils;
using NQutils.Def;
using NQutils.Storage;

sealed class ConstructIndexSemanticItemDefinition
{
    public ulong ItemTypeId { get; set; }
    public string ItemName { get; set; } = "";
    public string NormalizedItemName { get; set; } = "";
    public string NormalizedNeedle { get; set; } = "";
    public string ItemClass { get; set; } = "";
}

sealed class ConstructIndexElementRow
{
    public ulong LocalId { get; set; }
    public ulong ElementId { get; set; }
    public ulong ElementTypeId { get; set; }
    public string TypeName { get; set; } = "";
    public string Category { get; set; } = "";
    public string? CustomName { get; set; }
    public string DisplayName { get; set; } = "";
    public string NormalizedDisplayName { get; set; } = "";
    public string? NormalizedCustomName { get; set; }
    public string NormalizedTypeName { get; set; } = "";
    public string SemanticText { get; set; } = "";
    public ulong? SemanticItemTypeId { get; set; }
    public string? SemanticItemName { get; set; }
    public string? SemanticItemClass { get; set; }
    public string? IndustryFamily { get; set; }
    public int? IndustryTier { get; set; }
    public bool IsIndustry { get; set; }
    public bool IsTransferUnit { get; set; }
    public bool IsContainer { get; set; }
    public string? StorageOutputMode { get; set; }
    public ulong? HubLocalId { get; set; }
    public double? PositionX { get; set; }
    public double? PositionY { get; set; }
    public double? PositionZ { get; set; }
    public int IncomingLinkCount { get; set; }
    public int OutgoingLinkCount { get; set; }
}

public sealed partial class MyDuMod
{
    private const string ConstructIndexDatabaseFileName = "constructs.sqlite";
    private static readonly string[] ConstructIndexKnownOreNames =
    {
        "Acanthite",
        "Bauxite",
        "Chromite",
        "Coal",
        "Cobaltite",
        "Cryolite",
        "Garnierite",
        "Gold Nuggets",
        "Hematite",
        "Kolbeckite",
        "Limestone",
        "Malachite",
        "Natron",
        "Petalite",
        "Pyrite",
        "Quartz"
    };
    private readonly object constructIndexSchemaGate = new();
    private bool constructIndexSchemaReady;
    private readonly object constructIndexSemanticItemsGate = new();
    private IReadOnlyList<ConstructIndexSemanticItemDefinition>? constructIndexSemanticItems;

    private sealed class ConstructIndexStorageTopology
    {
        public string? StorageOutputMode { get; set; }
        public ulong? HubLocalId { get; set; }
    }

    private async Task<JObject> BuildRefreshConstructIndexPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var context = await LoadConstructIndexContext(requesterPlayerId, requestedConstructId);
        var linkList = EnumerateDistinctConstructLinks(context.Elements).ToList();

        PersistConstructIndexSnapshot(context, linkList);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "refresh_construct_index",
            ["construct"] = BuildConstructDescriptor(context),
            ["summary"] = new JObject
            {
                ["elementCount"] = context.Elements.Count,
                ["linkCount"] = linkList.Count,
                ["refreshedAtUtc"] = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture)
            }
        };
    }

    private async Task<JObject> BuildQueryConstructIndexPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;
        var exactName = selector["exactName"]?.Value<string>()?.Trim();
        var nameContains = selector["nameContains"]?.Value<string>()?.Trim();
        var industryFamily = selector["industryFamily"]?.Value<string>()?.Trim();
        var categories = ReadStringTokenList(selector["categories"]);
        var singleCategory = selector["category"]?.Value<string>()?.Trim();
        if (!string.IsNullOrWhiteSpace(singleCategory))
        {
            categories.Add(singleCategory!);
        }
        categories = categories
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var requestedTier = ReadInt32Token(selector["industryTier"]);
        var requestedLimit = ReadInt32Token(selector["limit"]);
        var limit = ClampInt32(requestedLimit, 1, 500, 100);
        var requestedItemClass = NormalizeConstructIndexItemClass(selector["itemClass"]?.Value<string>()?.Trim());
        var producesItemName = selector["producesItemName"]?.Value<string>()?.Trim();
        var consumesItemName = selector["consumesItemName"]?.Value<string>()?.Trim();
        ulong? semanticItemTypeId = null;
        string? semanticItemName = selector["itemName"]?.Value<string>()?.Trim();
        var requestedItemTypeId = ReadUInt64Token(selector["itemTypeId"]);
        if (requestedItemTypeId.HasValue && requestedItemTypeId.Value > 0)
        {
            var item = ResolveInventoryItem(new JObject
            {
                ["itemTypeId"] = requestedItemTypeId.Value
            });
            semanticItemTypeId = item.ItemTypeId;
            semanticItemName = item.ItemName;
        }

        var producedTypeFilter = string.IsNullOrWhiteSpace(producesItemName)
            ? (ProducerTypeIds: new HashSet<ulong>(), RecipeIds: new HashSet<ulong>())
            : await ResolveConstructIndexProducerTypesForProductName(producesItemName!);
        var consumedTypeFilter = string.IsNullOrWhiteSpace(consumesItemName)
            ? (ProducerTypeIds: new HashSet<ulong>(), RecipeIds: new HashSet<ulong>())
            : await ResolveConstructIndexProducerTypesForIngredientName(consumesItemName!);
        var producerTypeFilter = IntersectConstructIndexProducerTypeFilters(
            string.IsNullOrWhiteSpace(producesItemName) ? null : producedTypeFilter.ProducerTypeIds,
            string.IsNullOrWhiteSpace(consumesItemName) ? null : consumedTypeFilter.ProducerTypeIds);
        var matchedRecipeIds = new HashSet<ulong>(producedTypeFilter.RecipeIds);
        matchedRecipeIds.UnionWith(consumedTypeFilter.RecipeIds);

        if (producerTypeFilter is not null && producerTypeFilter.Count == 0)
        {
            return new JObject
            {
                ["commandId"] = commandId,
                ["success"] = true,
                ["error"] = JValue.CreateNull(),
                ["method"] = "query_construct_index",
                ["construct"] = BuildConstructDescriptor(constructContext),
                ["summary"] = new JObject
                {
                    ["resultCount"] = 0,
                    ["limit"] = limit,
                    ["exactName"] = string.IsNullOrWhiteSpace(exactName) ? JValue.CreateNull() : exactName,
                    ["nameContains"] = string.IsNullOrWhiteSpace(nameContains) ? JValue.CreateNull() : nameContains,
                    ["industryFamily"] = string.IsNullOrWhiteSpace(industryFamily) ? JValue.CreateNull() : NormalizeConstructIndexText(industryFamily),
                    ["industryTier"] = requestedTier.HasValue ? new JValue(requestedTier.Value) : JValue.CreateNull(),
                    ["itemTypeId"] = semanticItemTypeId.HasValue ? new JValue(semanticItemTypeId.Value) : JValue.CreateNull(),
                    ["itemName"] = string.IsNullOrWhiteSpace(semanticItemName) ? JValue.CreateNull() : semanticItemName,
                    ["itemClass"] = string.IsNullOrWhiteSpace(requestedItemClass) ? JValue.CreateNull() : requestedItemClass,
                    ["producesItemName"] = string.IsNullOrWhiteSpace(producesItemName) ? JValue.CreateNull() : producesItemName,
                    ["consumesItemName"] = string.IsNullOrWhiteSpace(consumesItemName) ? JValue.CreateNull() : consumesItemName,
                    ["matchedRecipeCount"] = matchedRecipeIds.Count,
                    ["matchedProducerTypeCount"] = 0,
                    ["categories"] = new JArray(categories)
                },
                ["results"] = new JArray()
            };
        }

        using var connection = OpenConstructIndexConnection();
        using var command = connection.CreateCommand();
        var sql = "SELECT local_id, type_name, category, custom_name, display_name, semantic_item_type_id, semantic_item_name, semantic_item_class, industry_family, industry_tier, storage_output_mode, hub_local_id, incoming_link_count, outgoing_link_count FROM elements WHERE construct_id = $constructId";
        command.Parameters.AddWithValue("$constructId", (long)constructId);

        if (categories.Count > 0)
        {
            var placeholders = new List<string>(categories.Count);
            for (var index = 0; index < categories.Count; index++)
            {
                var parameterName = "$category" + index.ToString(CultureInfo.InvariantCulture);
                placeholders.Add(parameterName);
                command.Parameters.AddWithValue(parameterName, categories[index]);
            }

            sql += " AND category IN (" + string.Join(", ", placeholders) + ")";
        }

        if (!string.IsNullOrWhiteSpace(exactName))
        {
            sql += " AND ((custom_name IS NOT NULL AND custom_name = $exactName) OR type_name = $exactName)";
            command.Parameters.AddWithValue("$exactName", exactName);
        }

        if (!string.IsNullOrWhiteSpace(nameContains))
        {
            sql += " AND semantic_text LIKE $nameContains";
            command.Parameters.AddWithValue("$nameContains", "%" + NormalizeConstructIndexText(nameContains) + "%");
        }

        if (!string.IsNullOrWhiteSpace(industryFamily))
        {
            sql += " AND industry_family = $industryFamily";
            command.Parameters.AddWithValue("$industryFamily", NormalizeConstructIndexText(industryFamily));
        }

        if (requestedTier.HasValue)
        {
            sql += " AND industry_tier = $industryTier";
            command.Parameters.AddWithValue("$industryTier", requestedTier.Value);
        }

        if (semanticItemTypeId.HasValue && semanticItemTypeId.Value > 0)
        {
            sql += " AND semantic_item_type_id = $semanticItemTypeId";
            command.Parameters.AddWithValue("$semanticItemTypeId", (long)semanticItemTypeId.Value);
        }

        if (!string.IsNullOrWhiteSpace(semanticItemName))
        {
            sql += " AND semantic_item_name = $semanticItemName";
            command.Parameters.AddWithValue("$semanticItemName", semanticItemName);
        }

        if (!string.IsNullOrWhiteSpace(requestedItemClass))
        {
            sql += " AND semantic_item_class = $semanticItemClass";
            command.Parameters.AddWithValue("$semanticItemClass", requestedItemClass);
        }

        if (producerTypeFilter is not null)
        {
            var placeholders = new List<string>(producerTypeFilter.Count);
            var producerIndex = 0;
            foreach (var producerTypeId in producerTypeFilter.OrderBy(value => value))
            {
                var parameterName = "$producerTypeId" + producerIndex.ToString(CultureInfo.InvariantCulture);
                placeholders.Add(parameterName);
                command.Parameters.AddWithValue(parameterName, (long)producerTypeId);
                producerIndex += 1;
            }

            sql += " AND element_type_id IN (" + string.Join(", ", placeholders) + ")";
        }

        sql += " ORDER BY category, COALESCE(custom_name, display_name), local_id LIMIT $limit";
        command.Parameters.AddWithValue("$limit", limit);
        command.CommandText = sql;

        var results = new JArray();
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                results.Add(new JObject
                {
                    ["id"] = reader.GetInt64(0),
                    ["typeName"] = reader.GetString(1),
                    ["category"] = reader.GetString(2),
                    ["name"] = reader.IsDBNull(3) ? JValue.CreateNull() : reader.GetString(3),
                    ["label"] = reader.GetString(4),
                    ["itemTypeId"] = reader.IsDBNull(5) ? JValue.CreateNull() : new JValue(reader.GetInt64(5)),
                    ["itemName"] = reader.IsDBNull(6) ? JValue.CreateNull() : reader.GetString(6),
                    ["itemClass"] = reader.IsDBNull(7) ? JValue.CreateNull() : reader.GetString(7),
                    ["industryFamily"] = reader.IsDBNull(8) ? JValue.CreateNull() : reader.GetString(8),
                    ["industryTier"] = reader.IsDBNull(9) ? JValue.CreateNull() : new JValue(reader.GetInt32(9)),
                    ["storageOutputMode"] = reader.IsDBNull(10) ? JValue.CreateNull() : reader.GetString(10),
                    ["hubId"] = reader.IsDBNull(11) ? JValue.CreateNull() : new JValue(reader.GetInt64(11)),
                    ["incomingLinkCount"] = reader.GetInt32(12),
                    ["outgoingLinkCount"] = reader.GetInt32(13)
                });
            }
        }

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "query_construct_index",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["summary"] = new JObject
            {
                ["resultCount"] = results.Count,
                ["limit"] = limit,
                ["exactName"] = string.IsNullOrWhiteSpace(exactName) ? JValue.CreateNull() : exactName,
                ["nameContains"] = string.IsNullOrWhiteSpace(nameContains) ? JValue.CreateNull() : nameContains,
                ["industryFamily"] = string.IsNullOrWhiteSpace(industryFamily) ? JValue.CreateNull() : NormalizeConstructIndexText(industryFamily),
                ["industryTier"] = requestedTier.HasValue ? new JValue(requestedTier.Value) : JValue.CreateNull(),
                ["itemTypeId"] = semanticItemTypeId.HasValue ? new JValue(semanticItemTypeId.Value) : JValue.CreateNull(),
                ["itemName"] = string.IsNullOrWhiteSpace(semanticItemName) ? JValue.CreateNull() : semanticItemName,
                ["itemClass"] = string.IsNullOrWhiteSpace(requestedItemClass) ? JValue.CreateNull() : requestedItemClass,
                ["producesItemName"] = string.IsNullOrWhiteSpace(producesItemName) ? JValue.CreateNull() : producesItemName,
                ["consumesItemName"] = string.IsNullOrWhiteSpace(consumesItemName) ? JValue.CreateNull() : consumesItemName,
                ["matchedRecipeCount"] = matchedRecipeIds.Count,
                ["matchedProducerTypeCount"] = producerTypeFilter?.Count ?? 0,
                ["categories"] = new JArray(categories)
            },
            ["results"] = results
        };
    }

    private async Task<JObject> BuildRelatedConstructIndexPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();
        var maxDepth = ClampInt32(ReadInt32Token(selector["maxDepth"]), 1, 4, 1);
        var outputCategories = ReadStringTokenList(selector["categories"])
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var selectorCount = 0;
        selectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        selectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (selectorCount != 1)
        {
            return CreateToolboxOpsFailure(commandId, "related_construct_index", "related_selector_requires_exactly_one_of_localId_name");
        }

        using var connection = OpenConstructIndexConnection();
        var focusLocalId = ResolveConstructIndexFocusLocalId(connection, constructId, requestedLocalId, requestedName);
        var allLinks = LoadConstructIndexLinks(connection, constructId);
        var visitedDepth = new Dictionary<ulong, int>
        {
            [focusLocalId] = 0
        };
        var queue = new Queue<ulong>();
        queue.Enqueue(focusLocalId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            var depth = visitedDepth[current];
            if (depth >= maxDepth)
            {
                continue;
            }

            foreach (var neighbor in EnumerateNeighborLocalIds(allLinks, current))
            {
                if (visitedDepth.ContainsKey(neighbor))
                {
                    continue;
                }

                visitedDepth[neighbor] = depth + 1;
                queue.Enqueue(neighbor);
            }
        }

        var visitedIds = visitedDepth.Keys.OrderBy(value => value).ToList();
        var nodeByLocalId = LoadConstructIndexNodes(connection, constructId, visitedIds);
        var includedNodeIds = new HashSet<ulong>(
            nodeByLocalId.Values
                .Where(node =>
                    node.LocalId == focusLocalId
                    || outputCategories.Count == 0
                    || outputCategories.Contains(node.Category, StringComparer.OrdinalIgnoreCase))
                .Select(node => node.LocalId));

        var nodes = new JArray(
            nodeByLocalId.Values
                .Where(node => includedNodeIds.Contains(node.LocalId))
                .OrderBy(node => visitedDepth.TryGetValue(node.LocalId, out var depth) ? depth : int.MaxValue)
                .ThenBy(node => node.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(node => node.LocalId)
                .Select(node => new JObject
                {
                    ["id"] = node.LocalId,
                    ["name"] = string.IsNullOrWhiteSpace(node.CustomName) ? JValue.CreateNull() : node.CustomName,
                    ["label"] = node.DisplayName,
                    ["typeName"] = node.TypeName,
                    ["category"] = node.Category,
                    ["itemTypeId"] = node.SemanticItemTypeId.HasValue ? new JValue(node.SemanticItemTypeId.Value) : JValue.CreateNull(),
                    ["itemName"] = string.IsNullOrWhiteSpace(node.SemanticItemName) ? JValue.CreateNull() : node.SemanticItemName,
                    ["itemClass"] = string.IsNullOrWhiteSpace(node.SemanticItemClass) ? JValue.CreateNull() : node.SemanticItemClass,
                    ["industryFamily"] = string.IsNullOrWhiteSpace(node.IndustryFamily) ? JValue.CreateNull() : node.IndustryFamily,
                    ["industryTier"] = node.IndustryTier.HasValue ? new JValue(node.IndustryTier.Value) : JValue.CreateNull(),
                    ["storageOutputMode"] = string.IsNullOrWhiteSpace(node.StorageOutputMode) ? JValue.CreateNull() : node.StorageOutputMode,
                    ["hubId"] = node.HubLocalId.HasValue ? new JValue(node.HubLocalId.Value) : JValue.CreateNull(),
                    ["depth"] = visitedDepth.TryGetValue(node.LocalId, out var depth) ? depth : maxDepth
                }));

        var links = new JArray(
            allLinks
                .Where(link => includedNodeIds.Contains(link.FromLocalId) && includedNodeIds.Contains(link.ToLocalId))
                .OrderBy(link => link.FromLocalId)
                .ThenBy(link => link.ToLocalId)
                .Select(link => BuildConstructIndexLinkObject(link, nodeByLocalId)));

        if (!nodeByLocalId.TryGetValue(focusLocalId, out var focusNode))
        {
            throw new ToolboxOpsException("related_focus_not_found");
        }

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "related_construct_index",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["focus"] = new JObject
            {
                ["id"] = focusNode.LocalId,
                ["name"] = string.IsNullOrWhiteSpace(focusNode.CustomName) ? JValue.CreateNull() : focusNode.CustomName,
                ["label"] = focusNode.DisplayName,
                ["typeName"] = focusNode.TypeName,
                ["category"] = focusNode.Category,
                ["storageOutputMode"] = string.IsNullOrWhiteSpace(focusNode.StorageOutputMode) ? JValue.CreateNull() : focusNode.StorageOutputMode,
                ["hubId"] = focusNode.HubLocalId.HasValue ? new JValue(focusNode.HubLocalId.Value) : JValue.CreateNull()
            },
            ["summary"] = new JObject
            {
                ["maxDepth"] = maxDepth,
                ["nodeCount"] = nodes.Count,
                ["linkCount"] = links.Count,
                ["categories"] = new JArray(outputCategories)
            },
            ["nodes"] = nodes,
            ["links"] = links
        };
    }

    private async Task<JObject> BuildDescribeIndustrySupportsPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();
        var requestedIndustryFamily = selector["industryFamily"]?.Value<string>()?.Trim();
        var limit = ClampInt32(ReadInt32Token(selector["limit"]), 1, 500, 200);

        var selectorCount = 0;
        selectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        selectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (selectorCount > 1)
        {
            return CreateToolboxOpsFailure(commandId, "describe_industry_supports", "support_selector_requires_at_most_one_of_localId_name");
        }

        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;

        using var connection = OpenConstructIndexConnection();
        var nodesByLocalId = LoadAllConstructIndexNodes(connection, constructId);
        var allLinks = LoadConstructIndexLinks(connection, constructId);
        var supportLocalIds = allLinks
            .Where(link =>
                nodesByLocalId.TryGetValue(link.FromLocalId, out var sourceNode)
                && IsConstructIndexStorageNode(sourceNode)
                && nodesByLocalId.TryGetValue(link.ToLocalId, out var targetNode)
                && IsConstructIndexIndustryConsumerNode(targetNode, requestedIndustryFamily))
            .Select(link => link.FromLocalId)
            .Distinct()
            .OrderBy(localId => nodesByLocalId.TryGetValue(localId, out var node) ? node.DisplayName : "", StringComparer.OrdinalIgnoreCase)
            .ThenBy(localId => localId)
            .ToList();

        if (selectorCount == 1)
        {
            var focusLocalId = ResolveConstructIndexFocusLocalId(connection, constructId, requestedLocalId, requestedName);
            if (!supportLocalIds.Contains(focusLocalId))
            {
                return CreateToolboxOpsFailure(commandId, "describe_industry_supports", "industry_support_not_found");
            }

            supportLocalIds = supportLocalIds.Where(localId => localId == focusLocalId).ToList();
        }

        var totalSupportCount = supportLocalIds.Count;
        var limitedSupportLocalIds = supportLocalIds.Take(limit).ToList();
        var results = new JArray();
        var totalConsumerCount = 0;
        var totalFeederCount = 0;

        foreach (var supportLocalId in limitedSupportLocalIds)
        {
            if (!nodesByLocalId.TryGetValue(supportLocalId, out var supportNode))
            {
                continue;
            }

            var refillTargetNode = ResolveIndustrySupportRefillTargetNode(supportNode, nodesByLocalId);
            var consumerLocalIds = allLinks
                .Where(link =>
                    link.FromLocalId == supportLocalId
                    && nodesByLocalId.TryGetValue(link.ToLocalId, out var targetNode)
                    && IsConstructIndexIndustryConsumerNode(targetNode, requestedIndustryFamily))
                .Select(link => link.ToLocalId)
                .Distinct()
                .OrderBy(localId => nodesByLocalId.TryGetValue(localId, out var node) ? node.DisplayName : "", StringComparer.OrdinalIgnoreCase)
                .ThenBy(localId => localId)
                .ToList();
            var feederLocalIds = allLinks
                .Where(link =>
                    link.ToLocalId == refillTargetNode.LocalId
                    && nodesByLocalId.TryGetValue(link.FromLocalId, out var feederNode)
                    && IsConstructIndexTransferNode(feederNode))
                .Select(link => link.FromLocalId)
                .Distinct()
                .OrderBy(localId => nodesByLocalId.TryGetValue(localId, out var node) ? node.DisplayName : "", StringComparer.OrdinalIgnoreCase)
                .ThenBy(localId => localId)
                .ToList();

            var consumers = new JArray(consumerLocalIds
                .Where(nodesByLocalId.ContainsKey)
                .Select(localId => BuildConstructIndexElementObject(nodesByLocalId[localId])));
            var feeders = new JArray();

            foreach (var feederLocalId in feederLocalIds)
            {
                if (!nodesByLocalId.TryGetValue(feederLocalId, out var feederNode))
                {
                    continue;
                }

                var sourceLocalIds = allLinks
                    .Where(link =>
                        link.ToLocalId == feederLocalId
                        && nodesByLocalId.TryGetValue(link.FromLocalId, out var sourceNode)
                        && IsConstructIndexStorageNode(sourceNode))
                    .Select(link => link.FromLocalId)
                    .Distinct()
                    .OrderBy(localId => nodesByLocalId.TryGetValue(localId, out var node) ? node.DisplayName : "", StringComparer.OrdinalIgnoreCase)
                    .ThenBy(localId => localId)
                    .ToList();

                feeders.Add(new JObject
                {
                    ["target"] = BuildConstructIndexElementObject(feederNode),
                    ["sources"] = new JArray(sourceLocalIds
                        .Where(nodesByLocalId.ContainsKey)
                        .Select(localId => BuildConstructIndexElementObject(nodesByLocalId[localId]))),
                    ["runtime"] = await BuildIndustrySupportFeederRuntimeObject(feederNode)
                });
            }

            totalConsumerCount += consumerLocalIds.Count;
            totalFeederCount += feederLocalIds.Count;
            results.Add(new JObject
            {
                ["support"] = BuildConstructIndexElementObject(supportNode),
                ["refillTarget"] = BuildConstructIndexElementObject(refillTargetNode),
                ["consumerCount"] = consumerLocalIds.Count,
                ["consumers"] = consumers,
                ["feederCount"] = feederLocalIds.Count,
                ["feeders"] = feeders
            });
        }

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "describe_industry_supports",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["summary"] = new JObject
            {
                ["totalSupportCount"] = totalSupportCount,
                ["returnedSupportCount"] = results.Count,
                ["totalConsumerCount"] = totalConsumerCount,
                ["totalFeederCount"] = totalFeederCount,
                ["industryFamily"] = string.IsNullOrWhiteSpace(requestedIndustryFamily) ? JValue.CreateNull() : NormalizeConstructIndexText(requestedIndustryFamily),
                ["limit"] = limit
            },
            ["results"] = results
        };
    }

    private async Task<JObject> BuildDescribeIndustrySupportStoragePayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var itemLimit = ClampInt32(ReadInt32Token(selector["itemLimit"]), 1, 500, 50);
        var includeFeederSources = selector["includeFeederSources"]?.Value<bool?>() ?? true;
        var basePayload = await BuildDescribeIndustrySupportsPayload(commandId, requesterPlayerId, payload);
        if (basePayload["success"]?.Value<bool>() != true)
        {
            return basePayload;
        }

        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var elementByLocalId = constructContext.Elements
            .GroupBy(element => (ulong)element.localId)
            .ToDictionary(group => group.Key, group => group.First());
        var results = basePayload["results"] as JArray ?? new JArray();

        foreach (var token in results.OfType<JObject>())
        {
            if (token["support"] is JObject support && ReadUInt64Token(support["id"]).HasValue)
            {
                token["supportSnapshot"] = await TryBuildIndexedStorageSnapshotObject(
                    requesterPlayerId,
                    constructContext,
                    elementByLocalId,
                    ReadUInt64Token(support["id"])!.Value,
                    itemLimit);
            }

            if (token["refillTarget"] is JObject refillTarget && ReadUInt64Token(refillTarget["id"]).HasValue)
            {
                token["refillTargetSnapshot"] = await TryBuildIndexedStorageSnapshotObject(
                    requesterPlayerId,
                    constructContext,
                    elementByLocalId,
                    ReadUInt64Token(refillTarget["id"])!.Value,
                    itemLimit);
            }

            if (token["feeders"] is not JArray feeders)
            {
                continue;
            }

            foreach (var feederToken in feeders.OfType<JObject>())
            {
                if (!includeFeederSources)
                {
                    continue;
                }

                if (feederToken["sources"] is not JArray sources)
                {
                    continue;
                }

                var sourceSnapshots = new JArray();
                foreach (var sourceToken in sources.OfType<JObject>())
                {
                    var sourceLocalId = ReadUInt64Token(sourceToken["id"]);
                    if (!sourceLocalId.HasValue)
                    {
                        continue;
                    }

                    sourceSnapshots.Add(new JObject
                    {
                        ["source"] = sourceToken,
                        ["snapshot"] = await TryBuildIndexedStorageSnapshotObject(
                            requesterPlayerId,
                            constructContext,
                            elementByLocalId,
                            sourceLocalId.Value,
                            itemLimit)
                    });
                }

                feederToken["sourceSnapshots"] = sourceSnapshots;
            }
        }

        basePayload["method"] = "describe_industry_support_storage";
        if (basePayload["summary"] is JObject summary)
        {
            summary["itemLimit"] = itemLimit;
            summary["includeFeederSources"] = includeFeederSources;
        }

        return basePayload;
    }

    private async Task<JToken> TryBuildIndexedStorageSnapshotObject(
        ulong requesterPlayerId,
        ConstructInspectionContext constructContext,
        IReadOnlyDictionary<ulong, ElementInfo> elementByLocalId,
        ulong localId,
        int itemLimit)
    {
        if (!elementByLocalId.TryGetValue(localId, out var element))
        {
            return JValue.CreateNull();
        }

        var category = ResolveElementCategory(constructContext, element);
        if (!SupportsStorageRuntime(category))
        {
            return JValue.CreateNull();
        }

        var storageService = services.GetRequiredService<IItemStorageService>();
        var storage = await storageService.Get(StorageRef.Container((ElementId)element.elementId), (PlayerId)requesterPlayerId);
        return BuildStorageSnapshot(storage, category, itemLimit);
    }

    private async Task<JObject> BuildNearbyConstructIndexPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();
        var requestedIndustryFamily = selector["industryFamily"]?.Value<string>()?.Trim();
        var requestedRadiusMeters = selector["radiusMeters"]?.Value<double?>();
        var requestedVerticalToleranceMeters = selector["verticalToleranceMeters"]?.Value<double?>();
        var requestedLimit = ReadInt32Token(selector["limit"]);
        var radiusMeters = Math.Max(0.1, Math.Min(requestedRadiusMeters ?? 20.0, 500.0));
        var verticalToleranceMeters = requestedVerticalToleranceMeters.HasValue
            ? Math.Max(0.0, Math.Min(requestedVerticalToleranceMeters.Value, 500.0))
            : (double?)null;
        var limit = ClampInt32(requestedLimit, 1, 500, 100);

        var categories = ReadStringTokenList(selector["categories"]);
        var singleCategory = selector["category"]?.Value<string>()?.Trim();
        if (!string.IsNullOrWhiteSpace(singleCategory))
        {
            categories.Add(singleCategory!);
        }
        categories = categories
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var selectorCount = 0;
        selectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        selectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (selectorCount != 1)
        {
            return CreateToolboxOpsFailure(commandId, "nearby_construct_index", "nearby_selector_requires_exactly_one_of_localId_name");
        }

        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;

        using var connection = OpenConstructIndexConnection();
        var focusLocalId = ResolveConstructIndexFocusLocalId(connection, constructId, requestedLocalId, requestedName);
        var nodesByLocalId = LoadAllConstructIndexNodes(connection, constructId);
        if (!nodesByLocalId.TryGetValue(focusLocalId, out var focusNode))
        {
            return CreateToolboxOpsFailure(commandId, "nearby_construct_index", "nearby_focus_not_found");
        }

        if (!focusNode.PositionX.HasValue || !focusNode.PositionY.HasValue || !focusNode.PositionZ.HasValue)
        {
            return CreateToolboxOpsFailure(commandId, "nearby_construct_index", "nearby_focus_missing_position");
        }

        var normalizedIndustryFamily = string.IsNullOrWhiteSpace(requestedIndustryFamily)
            ? null
            : NormalizeConstructIndexText(requestedIndustryFamily);
        var matchingNodes = nodesByLocalId.Values
            .Where(node => node.LocalId != focusNode.LocalId)
            .Where(node => node.PositionX.HasValue && node.PositionY.HasValue && node.PositionZ.HasValue)
            .Where(node => categories.Count == 0 || categories.Contains(node.Category, StringComparer.OrdinalIgnoreCase))
            .Where(node => string.IsNullOrWhiteSpace(normalizedIndustryFamily)
                || string.Equals(node.IndustryFamily, normalizedIndustryFamily, StringComparison.OrdinalIgnoreCase))
            .Select(node =>
            {
                var dx = node.PositionX!.Value - focusNode.PositionX!.Value;
                var dy = node.PositionY!.Value - focusNode.PositionY!.Value;
                var dz = node.PositionZ!.Value - focusNode.PositionZ!.Value;
                var planarDistance = Math.Sqrt((dx * dx) + (dy * dy) + (dz * dz));
                return new
                {
                    Node = node,
                    Dx = dx,
                    Dy = dy,
                    Dz = dz,
                    DistanceMeters = planarDistance
                };
            })
            .Where(entry => entry.DistanceMeters <= radiusMeters)
            .Where(entry => !verticalToleranceMeters.HasValue || Math.Abs(entry.Dz) <= verticalToleranceMeters.Value)
            .OrderBy(entry => entry.DistanceMeters)
            .ThenBy(entry => entry.Node.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(entry => entry.Node.LocalId)
            .ToList();

        var totalMatchCount = matchingNodes.Count;
        var results = new JArray(matchingNodes
            .Take(limit)
            .Select(entry => BuildConstructIndexNearbyElementObject(entry.Node, entry.DistanceMeters, entry.Dx, entry.Dy, entry.Dz)));

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "nearby_construct_index",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["focus"] = BuildConstructIndexElementObject(focusNode, includePosition: true),
            ["summary"] = new JObject
            {
                ["radiusMeters"] = radiusMeters,
                ["verticalToleranceMeters"] = verticalToleranceMeters.HasValue ? new JValue(verticalToleranceMeters.Value) : JValue.CreateNull(),
                ["totalMatchCount"] = totalMatchCount,
                ["returnedMatchCount"] = results.Count,
                ["limit"] = limit,
                ["industryFamily"] = string.IsNullOrWhiteSpace(normalizedIndustryFamily) ? JValue.CreateNull() : normalizedIndustryFamily,
                ["categories"] = new JArray(categories)
            },
            ["results"] = results
        };
    }

    private async Task<JObject> BuildDescribeIndustryBranchPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();
        var limit = ClampInt32(ReadInt32Token(selector["limit"]), 1, 100, 12);

        var selectorCount = 0;
        selectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        selectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (selectorCount != 1)
        {
            return CreateToolboxOpsFailure(commandId, "describe_industry_branch", "branch_selector_requires_exactly_one_of_localId_name");
        }

        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;
        using var connection = OpenConstructIndexConnection();
        var focusLocalId = ResolveConstructIndexFocusLocalId(connection, constructId, requestedLocalId, requestedName);
        var nodesByLocalId = LoadAllConstructIndexNodes(connection, constructId);
        var allLinks = LoadConstructIndexLinks(connection, constructId);
        if (!nodesByLocalId.TryGetValue(focusLocalId, out var focusNode))
        {
            return CreateToolboxOpsFailure(commandId, "describe_industry_branch", "branch_focus_not_found");
        }

        var storageAnchorIds = ResolveConstructIndexBranchStorageAnchorIds(focusNode, allLinks, nodesByLocalId)
            .Take(limit)
            .ToList();
        var results = new JArray();
        var branchKinds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var storageAnchorId in storageAnchorIds)
        {
            if (!nodesByLocalId.TryGetValue(storageAnchorId, out var storageNode))
            {
                continue;
            }

            var refillTargetNode = ResolveIndustrySupportRefillTargetNode(storageNode, nodesByLocalId);
            var incomingIndustryIds = EnumerateConstructIndexIncomingNodeIds(
                allLinks,
                storageNode.LocalId,
                nodesByLocalId,
                node => node.IsIndustry).ToList();
            if (incomingIndustryIds.Count > 0)
            {
                const string branchKind = "direct_producer_bank_to_storage";
                branchKinds.Add(branchKind);
                results.Add(new JObject
                {
                    ["branchKind"] = branchKind,
                    ["storage"] = BuildConstructIndexElementObject(storageNode),
                    ["refillTarget"] = BuildConstructIndexElementObject(refillTargetNode),
                    ["producerBank"] = BuildConstructIndexNodeArray(incomingIndustryIds, nodesByLocalId),
                    ["consumerBank"] = BuildConstructIndexNodeArray(
                        EnumerateConstructIndexOutgoingNodeIds(allLinks, storageNode.LocalId, nodesByLocalId, node => node.IsIndustry),
                        nodesByLocalId)
                });
            }

            var incomingTransferIds = EnumerateConstructIndexIncomingNodeIds(
                allLinks,
                refillTargetNode.LocalId,
                nodesByLocalId,
                IsConstructIndexTransferNode).ToList();
            if (incomingTransferIds.Count > 0)
            {
                const string branchKind = "support_refill_tu_to_storage";
                branchKinds.Add(branchKind);
                var sourceStorageIds = incomingTransferIds
                    .SelectMany(localId => EnumerateConstructIndexIncomingNodeIds(
                        allLinks,
                        localId,
                        nodesByLocalId,
                        IsConstructIndexStorageNode))
                    .Distinct()
                    .OrderBy(localId => localId)
                    .ToList();
                results.Add(new JObject
                {
                    ["branchKind"] = branchKind,
                    ["storage"] = BuildConstructIndexElementObject(storageNode),
                    ["refillTarget"] = BuildConstructIndexElementObject(refillTargetNode),
                    ["transferBank"] = BuildConstructIndexNodeArray(incomingTransferIds, nodesByLocalId),
                    ["sourceStorages"] = BuildConstructIndexNodeArray(sourceStorageIds, nodesByLocalId),
                    ["consumerBank"] = BuildConstructIndexNodeArray(
                        EnumerateConstructIndexOutgoingNodeIds(allLinks, storageNode.LocalId, nodesByLocalId, node => node.IsIndustry),
                        nodesByLocalId)
                });
            }

            var outgoingTransferIds = EnumerateConstructIndexOutgoingNodeIds(
                allLinks,
                storageNode.LocalId,
                nodesByLocalId,
                IsConstructIndexTransferNode).ToList();
            if (outgoingTransferIds.Count > 0)
            {
                const string branchKind = "storage_to_distribution_tu_bank";
                branchKinds.Add(branchKind);
                var targetStorageIds = outgoingTransferIds
                    .SelectMany(localId => EnumerateConstructIndexOutgoingNodeIds(
                        allLinks,
                        localId,
                        nodesByLocalId,
                        IsConstructIndexStorageNode))
                    .Distinct()
                    .OrderBy(localId => localId)
                    .ToList();
                results.Add(new JObject
                {
                    ["branchKind"] = branchKind,
                    ["storage"] = BuildConstructIndexElementObject(storageNode),
                    ["distributionBank"] = BuildConstructIndexNodeArray(outgoingTransferIds, nodesByLocalId),
                    ["targetStorages"] = BuildConstructIndexNodeArray(targetStorageIds, nodesByLocalId)
                });
            }
        }

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "describe_industry_branch",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["focus"] = BuildConstructIndexElementObject(focusNode, includePosition: true),
            ["summary"] = new JObject
            {
                ["storageAnchorCount"] = storageAnchorIds.Count,
                ["branchCount"] = results.Count,
                ["branchKinds"] = new JArray(branchKinds.OrderBy(value => value, StringComparer.OrdinalIgnoreCase))
            },
            ["results"] = results
        };
    }

    private async Task<JObject> BuildTraceConstructIndexPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();
        var requestedDirection = NormalizeConstructIndexText(selector["direction"]?.Value<string>()?.Trim());
        var direction = string.Equals(requestedDirection, "downstream", StringComparison.OrdinalIgnoreCase)
            ? "downstream"
            : "upstream";
        var stopAtItemClass = NormalizeConstructIndexItemClass(selector["stopAtItemClass"]?.Value<string>()?.Trim());
        var stopAtIndustryFamily = NormalizeConstructIndexText(selector["stopAtIndustryFamily"]?.Value<string>()?.Trim());
        var maxHops = ClampInt32(ReadInt32Token(selector["maxHops"]), 1, 12, 4);

        var selectorCount = 0;
        selectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        selectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (selectorCount != 1)
        {
            return CreateToolboxOpsFailure(commandId, "trace_construct_index", "trace_selector_requires_exactly_one_of_localId_name");
        }

        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;
        using var connection = OpenConstructIndexConnection();
        var focusLocalId = ResolveConstructIndexFocusLocalId(connection, constructId, requestedLocalId, requestedName);
        var nodesByLocalId = LoadAllConstructIndexNodes(connection, constructId);
        var allLinks = LoadConstructIndexLinks(connection, constructId);
        if (!nodesByLocalId.TryGetValue(focusLocalId, out var focusNode))
        {
            return CreateToolboxOpsFailure(commandId, "trace_construct_index", "trace_focus_not_found");
        }

        var visited = new HashSet<ulong> { focusLocalId };
        var frontier = new List<ulong> { focusLocalId };
        var steps = new JArray();

        for (var hop = 1; hop <= maxHops && frontier.Count > 0; hop++)
        {
            var stepNodeObjects = new List<JObject>();
            var stepLinks = new List<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)>();
            var nextFrontier = new HashSet<ulong>();

            foreach (var currentLocalId in frontier.OrderBy(localId => localId))
            {
                var candidateLinks = direction == "upstream"
                    ? EnumerateConstructIndexIncomingLinks(allLinks, currentLocalId)
                    : EnumerateConstructIndexOutgoingLinks(allLinks, currentLocalId);
                foreach (var link in candidateLinks
                    .OrderBy(link => direction == "upstream" ? link.FromLocalId : link.ToLocalId)
                    .ThenBy(link => link.PlugType, StringComparer.Ordinal))
                {
                    var neighborLocalId = direction == "upstream" ? link.FromLocalId : link.ToLocalId;
                    if (!visited.Add(neighborLocalId))
                    {
                        continue;
                    }

                    if (!nodesByLocalId.TryGetValue(neighborLocalId, out var neighborNode))
                    {
                        continue;
                    }

                    stepLinks.Add(link);
                    var stopReason = ResolveConstructIndexTraceStopReason(neighborNode, stopAtItemClass, stopAtIndustryFamily);
                    var nodeObject = BuildConstructIndexElementObject(neighborNode);
                    nodeObject["stopReason"] = string.IsNullOrWhiteSpace(stopReason) ? JValue.CreateNull() : stopReason;
                    nodeObject["viaEdgeType"] = ResolveConstructIndexLinkEdgeType(link, nodesByLocalId);
                    stepNodeObjects.Add(nodeObject);
                    if (string.IsNullOrWhiteSpace(stopReason))
                    {
                        nextFrontier.Add(neighborLocalId);
                    }
                }
            }

            if (stepNodeObjects.Count == 0)
            {
                break;
            }

            steps.Add(new JObject
            {
                ["hop"] = hop,
                ["nodeCount"] = stepNodeObjects.Count,
                ["linkCount"] = stepLinks.Count,
                ["nodes"] = new JArray(stepNodeObjects
                    .OrderBy(node => node["label"]?.Value<string>() ?? "", StringComparer.OrdinalIgnoreCase)
                    .ThenBy(node => node["id"]?.Value<long>() ?? long.MaxValue)),
                ["links"] = new JArray(stepLinks.Select(link => BuildConstructIndexLinkObject(link, nodesByLocalId)))
            });

            frontier = nextFrontier.OrderBy(localId => localId).ToList();
        }

        var branchNodeIds = visited
            .Where(localId => ResolveConstructIndexDirectionalDegree(allLinks, localId, direction) > 1)
            .OrderBy(localId => localId)
            .ToList();

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "trace_construct_index",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["focus"] = BuildConstructIndexElementObject(focusNode, includePosition: true),
            ["summary"] = new JObject
            {
                ["direction"] = direction,
                ["maxHops"] = maxHops,
                ["visitedNodeCount"] = visited.Count,
                ["stepCount"] = steps.Count,
                ["stopAtItemClass"] = string.IsNullOrWhiteSpace(stopAtItemClass) ? JValue.CreateNull() : stopAtItemClass,
                ["stopAtIndustryFamily"] = string.IsNullOrWhiteSpace(stopAtIndustryFamily) ? JValue.CreateNull() : stopAtIndustryFamily
            },
            ["steps"] = steps,
            ["branchNodes"] = BuildConstructIndexNodeArray(branchNodeIds, nodesByLocalId)
        };
    }

    private async Task<JObject> BuildDescribeBankFromAnchorPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();
        var groupBy = NormalizeConstructIndexBankGroupBy(selector["groupBy"]?.Value<string>()?.Trim());
        var limit = ClampInt32(ReadInt32Token(selector["limit"]), 1, 50, 8);

        var selectorCount = 0;
        selectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        selectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (selectorCount != 1)
        {
            return CreateToolboxOpsFailure(commandId, "describe_bank_from_anchor", "bank_selector_requires_exactly_one_of_localId_name");
        }

        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;
        using var connection = OpenConstructIndexConnection();
        var focusLocalId = ResolveConstructIndexFocusLocalId(connection, constructId, requestedLocalId, requestedName);
        var nodesByLocalId = LoadAllConstructIndexNodes(connection, constructId);
        var allLinks = LoadConstructIndexLinks(connection, constructId);
        if (!nodesByLocalId.TryGetValue(focusLocalId, out var focusNode))
        {
            return CreateToolboxOpsFailure(commandId, "describe_bank_from_anchor", "bank_focus_not_found");
        }

        var prototypeIds = new List<(ulong LocalId, string Relation)>();
        if (focusNode.IsIndustry || focusNode.IsTransferUnit)
        {
            prototypeIds.Add((focusNode.LocalId, "self"));
        }
        else
        {
            prototypeIds.AddRange(
                EnumerateConstructIndexIncomingNodeIds(allLinks, focusNode.LocalId, nodesByLocalId, node => node.IsIndustry || node.IsTransferUnit)
                    .Select(localId => (localId, "upstream")));
            prototypeIds.AddRange(
                EnumerateConstructIndexOutgoingNodeIds(allLinks, focusNode.LocalId, nodesByLocalId, node => node.IsIndustry || node.IsTransferUnit)
                    .Select(localId => (localId, "downstream")));
        }

        var dedupedPrototypeIds = prototypeIds
            .GroupBy(entry => entry.LocalId)
            .Select(group => group.First())
            .Take(limit)
            .ToList();
        var results = new JArray();

        foreach (var prototype in dedupedPrototypeIds)
        {
            if (!nodesByLocalId.TryGetValue(prototype.LocalId, out var prototypeNode))
            {
                continue;
            }

            var memberIds = ResolveConstructIndexBankMemberIds(prototypeNode, allLinks, nodesByLocalId, groupBy)
                .OrderBy(localId => localId)
                .ToList();
            var sharedOutputStorageIds = memberIds
                .SelectMany(localId => EnumerateConstructIndexOutgoingNodeIds(allLinks, localId, nodesByLocalId, IsConstructIndexStorageNode))
                .Distinct()
                .OrderBy(localId => localId)
                .ToList();
            var sharedInputStorageIds = memberIds
                .SelectMany(localId => EnumerateConstructIndexIncomingNodeIds(allLinks, localId, nodesByLocalId, IsConstructIndexStorageNode))
                .Distinct()
                .OrderBy(localId => localId)
                .ToList();

            results.Add(new JObject
            {
                ["relationToAnchor"] = prototype.Relation,
                ["roleKind"] = prototypeNode.IsTransferUnit ? "transfer_bank" : "industry_bank",
                ["groupBy"] = groupBy,
                ["prototype"] = BuildConstructIndexElementObject(prototypeNode),
                ["memberCount"] = memberIds.Count,
                ["members"] = BuildConstructIndexNodeArray(memberIds, nodesByLocalId),
                ["sharedOutputStorages"] = BuildConstructIndexNodeArray(sharedOutputStorageIds, nodesByLocalId),
                ["sharedInputStorages"] = BuildConstructIndexNodeArray(sharedInputStorageIds, nodesByLocalId),
                ["sharedInputSignature"] = BuildConstructIndexStorageInputSignature(prototypeNode, allLinks, nodesByLocalId)
            });
        }

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "describe_bank_from_anchor",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["focus"] = BuildConstructIndexElementObject(focusNode, includePosition: true),
            ["summary"] = new JObject
            {
                ["groupBy"] = groupBy,
                ["bankCount"] = results.Count
            },
            ["results"] = results
        };
    }

    private async Task<JObject> BuildDescribeConsumerBankBranchesPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();

        var selectorCount = 0;
        selectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        selectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (selectorCount != 1)
        {
            return CreateToolboxOpsFailure(commandId, "describe_consumer_bank_branches", "consumer_branch_selector_requires_exactly_one_of_localId_name");
        }

        var constructContext = await EnsureConstructIndexSnapshot(requesterPlayerId, requestedConstructId);
        var constructId = (ulong)constructContext.ConstructId;
        using var connection = OpenConstructIndexConnection();
        var focusLocalId = ResolveConstructIndexFocusLocalId(connection, constructId, requestedLocalId, requestedName);
        var nodesByLocalId = LoadAllConstructIndexNodes(connection, constructId);
        var allLinks = LoadConstructIndexLinks(connection, constructId);
        if (!nodesByLocalId.TryGetValue(focusLocalId, out var focusNode))
        {
            return CreateToolboxOpsFailure(commandId, "describe_consumer_bank_branches", "consumer_branch_focus_not_found");
        }

        ConstructIndexElementRow? bankPrototype = null;
        if (focusNode.IsIndustry)
        {
            bankPrototype = focusNode;
        }
        else
        {
            var candidateIds = EnumerateConstructIndexIncomingNodeIds(allLinks, focusNode.LocalId, nodesByLocalId, node => node.IsIndustry).ToList();
            if (candidateIds.Count == 0)
            {
                candidateIds = EnumerateConstructIndexOutgoingNodeIds(allLinks, focusNode.LocalId, nodesByLocalId, node => node.IsIndustry).ToList();
            }

            bankPrototype = candidateIds
                .Select(localId => nodesByLocalId.TryGetValue(localId, out var node) ? node : null)
                .Where(node => node is not null)
                .OrderBy(node => node!.TypeName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(node => node!.LocalId)
                .FirstOrDefault();
        }

        if (bankPrototype is null)
        {
            return CreateToolboxOpsFailure(commandId, "describe_consumer_bank_branches", "consumer_bank_not_found");
        }

        var consumerBankIds = ResolveConstructIndexBankMemberIds(bankPrototype, allLinks, nodesByLocalId, "shared_input_support_pattern")
            .OrderBy(localId => localId)
            .ToList();
        var inputStorageIds = consumerBankIds
            .SelectMany(localId => EnumerateConstructIndexIncomingNodeIds(allLinks, localId, nodesByLocalId, IsConstructIndexStorageNode))
            .Distinct()
            .OrderBy(localId => localId)
            .ToList();
        var inputBranches = new JArray(
            inputStorageIds
                .GroupBy(localId => ResolveConstructIndexInputBranchKey(nodesByLocalId[localId]), StringComparer.OrdinalIgnoreCase)
                .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
                .Select(group =>
                {
                    var firstNode = nodesByLocalId[group.First()];
                    var upstreamAnchorIds = group
                        .SelectMany(localId => ResolveConstructIndexUpstreamStorageAnchorIds(localId, allLinks, nodesByLocalId))
                        .Where(localId => !group.Contains(localId))
                        .Distinct()
                        .OrderBy(localId => localId)
                        .ToList();
                    return new JObject
                    {
                        ["itemName"] = string.IsNullOrWhiteSpace(firstNode.SemanticItemName) ? JValue.CreateNull() : firstNode.SemanticItemName,
                        ["itemClass"] = string.IsNullOrWhiteSpace(firstNode.SemanticItemClass) ? JValue.CreateNull() : firstNode.SemanticItemClass,
                        ["anchorCount"] = group.Count(),
                        ["anchors"] = BuildConstructIndexNodeArray(group, nodesByLocalId),
                        ["upstreamStorageAnchors"] = BuildConstructIndexNodeArray(upstreamAnchorIds, nodesByLocalId)
                    };
                }));

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "describe_consumer_bank_branches",
            ["construct"] = BuildConstructDescriptor(constructContext),
            ["focus"] = BuildConstructIndexElementObject(focusNode, includePosition: true),
            ["consumerBank"] = BuildConstructIndexNodeArray(consumerBankIds, nodesByLocalId),
            ["summary"] = new JObject
            {
                ["consumerBankCount"] = consumerBankIds.Count,
                ["inputBranchCount"] = inputBranches.Count
            },
            ["inputBranches"] = inputBranches
        };
    }

    private async Task<ConstructInspectionContext> EnsureConstructIndexSnapshot(ulong requesterPlayerId, ulong? requestedConstructId)
    {
        var context = await LoadConstructIndexContext(requesterPlayerId, requestedConstructId);
        using var connection = OpenConstructIndexConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM constructs WHERE construct_id = $constructId LIMIT 1";
        command.Parameters.AddWithValue("$constructId", (long)(ulong)context.ConstructId);
        var exists = command.ExecuteScalar() is not null;
        if (exists)
        {
            return context;
        }

        PersistConstructIndexSnapshot(context, EnumerateDistinctConstructLinks(context.Elements).ToList());
        return context;
    }

    private async Task<ConstructInspectionContext> LoadConstructIndexContext(ulong requesterPlayerId, ulong? requestedConstructId)
    {
        var constructId = requestedConstructId.HasValue && requestedConstructId.Value > 0
            ? (ConstructId)requestedConstructId.Value
            : (await ResolveConstructIdForInspection(requesterPlayerId, null, 0)).ConstructId;
        var usedCurrentConstruct = !requestedConstructId.HasValue || requestedConstructId.Value == 0;
        return await LoadConstructInspectionContext(requesterPlayerId, constructId, usedCurrentConstruct);
    }

    private void PersistConstructIndexSnapshot(ConstructInspectionContext context, IReadOnlyCollection<LinkInfo> links)
    {
        using var connection = OpenConstructIndexConnection();
        using var transaction = connection.BeginTransaction();
        var nowUtc = DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture);

        using (var upsertConstruct = connection.CreateCommand())
        {
            upsertConstruct.Transaction = transaction;
            upsertConstruct.CommandText =
                "INSERT INTO constructs (construct_id, construct_name, owner_player_id, owner_organization_id, refreshed_at_utc, element_count, link_count) " +
                "VALUES ($constructId, $constructName, $ownerPlayerId, $ownerOrganizationId, $refreshedAtUtc, $elementCount, $linkCount) " +
                "ON CONFLICT(construct_id) DO UPDATE SET " +
                "construct_name = excluded.construct_name, " +
                "owner_player_id = excluded.owner_player_id, " +
                "owner_organization_id = excluded.owner_organization_id, " +
                "refreshed_at_utc = excluded.refreshed_at_utc, " +
                "element_count = excluded.element_count, " +
                "link_count = excluded.link_count";
            upsertConstruct.Parameters.AddWithValue("$constructId", (long)(ulong)context.ConstructId);
            upsertConstruct.Parameters.AddWithValue("$constructName", context.ConstructName);
            upsertConstruct.Parameters.AddWithValue("$ownerPlayerId", context.OwnerId.playerId == 0 ? DBNull.Value : (object)context.OwnerId.playerId);
            upsertConstruct.Parameters.AddWithValue("$ownerOrganizationId", context.OwnerId.organizationId == 0 ? DBNull.Value : (object)context.OwnerId.organizationId);
            upsertConstruct.Parameters.AddWithValue("$refreshedAtUtc", nowUtc);
            upsertConstruct.Parameters.AddWithValue("$elementCount", context.Elements.Count);
            upsertConstruct.Parameters.AddWithValue("$linkCount", links.Count);
            upsertConstruct.ExecuteNonQuery();
        }

        using (var deleteLinks = connection.CreateCommand())
        {
            deleteLinks.Transaction = transaction;
            deleteLinks.CommandText = "DELETE FROM links WHERE construct_id = $constructId";
            deleteLinks.Parameters.AddWithValue("$constructId", (long)(ulong)context.ConstructId);
            deleteLinks.ExecuteNonQuery();
        }

        using (var deleteElements = connection.CreateCommand())
        {
            deleteElements.Transaction = transaction;
            deleteElements.CommandText = "DELETE FROM elements WHERE construct_id = $constructId";
            deleteElements.Parameters.AddWithValue("$constructId", (long)(ulong)context.ConstructId);
            deleteElements.ExecuteNonQuery();
        }

        var incomingCounts = links
            .GroupBy(link => link.toElementId)
            .ToDictionary(group => group.Key, group => group.Count());
        var outgoingCounts = links
            .GroupBy(link => link.fromElementId)
            .ToDictionary(group => group.Key, group => group.Count());
        var semanticItems = GetConstructIndexSemanticItems();
        var elementLocalIdByElementId = context.Elements.ToDictionary(entry => entry.elementId, entry => (ulong)entry.localId);
        var elementCategoryByElementId = context.Elements.ToDictionary(
            entry => entry.elementId,
            entry => ResolveElementCategory(context, entry),
            EqualityComparer<ulong>.Default);
        var storageTopologyByElementId = ResolveConstructIndexStorageTopologies(
            context.Elements,
            links,
            elementLocalIdByElementId,
            elementCategoryByElementId);

        using (var insertElement = connection.CreateCommand())
        {
            insertElement.Transaction = transaction;
            insertElement.CommandText =
                "INSERT INTO elements (" +
                "construct_id, local_id, element_id, element_type_id, type_name, category, custom_name, display_name, normalized_display_name, normalized_custom_name, normalized_type_name, semantic_text, semantic_item_type_id, semantic_item_name, semantic_item_class, industry_family, industry_tier, is_industry, is_transfer_unit, is_container, storage_output_mode, hub_local_id, position_x, position_y, position_z, incoming_link_count, outgoing_link_count" +
                ") VALUES (" +
                "$constructId, $localId, $elementId, $elementTypeId, $typeName, $category, $customName, $displayName, $normalizedDisplayName, $normalizedCustomName, $normalizedTypeName, $semanticText, $semanticItemTypeId, $semanticItemName, $semanticItemClass, $industryFamily, $industryTier, $isIndustry, $isTransferUnit, $isContainer, $storageOutputMode, $hubLocalId, $positionX, $positionY, $positionZ, $incomingLinkCount, $outgoingLinkCount" +
                ")";

            foreach (var element in context.Elements.OrderBy(entry => entry.localId))
            {
                insertElement.Parameters.Clear();
                var typeName = ResolveElementTypeName(context, element);
                var customName = TryReadElementCustomName(element);
                var displayName = string.IsNullOrWhiteSpace(customName) ? typeName : customName!;
                var category = ResolveElementCategory(context, element);
                var industryFamily = ResolveConstructIndexIndustryFamily(element, typeName);
                var industryTier = ResolveConstructIndexIndustryTier(element, typeName);
                var normalizedDisplayName = NormalizeConstructIndexText(displayName);
                var normalizedCustomName = string.IsNullOrWhiteSpace(customName) ? null : NormalizeConstructIndexText(customName);
                var normalizedTypeName = NormalizeConstructIndexText(typeName);
                var isTransferUnit = string.Equals(category, "transfer", StringComparison.OrdinalIgnoreCase);
                var isIndustry = string.Equals(category, "industry", StringComparison.OrdinalIgnoreCase);
                var isContainer = string.Equals(category, "container", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(category, "container_hub", StringComparison.OrdinalIgnoreCase);
                var semanticText = NormalizeConstructIndexText((customName ?? "") + " " + typeName);
                var semanticItem = ResolveConstructIndexSemanticItemForElement(
                    semanticItems,
                    displayName,
                    customName,
                    typeName,
                    isContainer);
                storageTopologyByElementId.TryGetValue(element.elementId, out var storageTopology);

                insertElement.Parameters.AddWithValue("$constructId", (long)(ulong)context.ConstructId);
                insertElement.Parameters.AddWithValue("$localId", (long)element.localId);
                insertElement.Parameters.AddWithValue("$elementId", (long)element.elementId);
                insertElement.Parameters.AddWithValue("$elementTypeId", (long)element.elementType);
                insertElement.Parameters.AddWithValue("$typeName", typeName);
                insertElement.Parameters.AddWithValue("$category", category);
                insertElement.Parameters.AddWithValue("$customName", string.IsNullOrWhiteSpace(customName) ? DBNull.Value : (object)customName!);
                insertElement.Parameters.AddWithValue("$displayName", displayName);
                insertElement.Parameters.AddWithValue("$normalizedDisplayName", normalizedDisplayName);
                insertElement.Parameters.AddWithValue("$normalizedCustomName", string.IsNullOrWhiteSpace(normalizedCustomName) ? DBNull.Value : (object)normalizedCustomName!);
                insertElement.Parameters.AddWithValue("$normalizedTypeName", normalizedTypeName);
                insertElement.Parameters.AddWithValue("$semanticText", semanticText);
                insertElement.Parameters.AddWithValue("$semanticItemTypeId", semanticItem?.ItemTypeId is ulong itemTypeId && itemTypeId > 0 ? (object)(long)itemTypeId : DBNull.Value);
                insertElement.Parameters.AddWithValue("$semanticItemName", string.IsNullOrWhiteSpace(semanticItem?.ItemName) ? DBNull.Value : (object)semanticItem!.ItemName);
                insertElement.Parameters.AddWithValue("$semanticItemClass", string.IsNullOrWhiteSpace(semanticItem?.ItemClass) ? DBNull.Value : (object)semanticItem!.ItemClass);
                insertElement.Parameters.AddWithValue("$industryFamily", string.IsNullOrWhiteSpace(industryFamily) ? DBNull.Value : (object)industryFamily!);
                insertElement.Parameters.AddWithValue("$industryTier", industryTier.HasValue ? (object)industryTier.Value : DBNull.Value);
                insertElement.Parameters.AddWithValue("$isIndustry", isIndustry ? 1 : 0);
                insertElement.Parameters.AddWithValue("$isTransferUnit", isTransferUnit ? 1 : 0);
                insertElement.Parameters.AddWithValue("$isContainer", isContainer ? 1 : 0);
                insertElement.Parameters.AddWithValue("$storageOutputMode", string.IsNullOrWhiteSpace(storageTopology?.StorageOutputMode) ? DBNull.Value : (object)storageTopology!.StorageOutputMode!);
                insertElement.Parameters.AddWithValue("$hubLocalId", storageTopology?.HubLocalId.HasValue == true ? (object)(long)storageTopology.HubLocalId.Value : DBNull.Value);
                insertElement.Parameters.AddWithValue("$positionX", element.position.x);
                insertElement.Parameters.AddWithValue("$positionY", element.position.y);
                insertElement.Parameters.AddWithValue("$positionZ", element.position.z);
                insertElement.Parameters.AddWithValue("$incomingLinkCount", incomingCounts.TryGetValue(element.elementId, out var incomingCount) ? incomingCount : 0);
                insertElement.Parameters.AddWithValue("$outgoingLinkCount", outgoingCounts.TryGetValue(element.elementId, out var outgoingCount) ? outgoingCount : 0);
                insertElement.ExecuteNonQuery();
            }
        }

        using (var insertLink = connection.CreateCommand())
        {
            insertLink.Transaction = transaction;
            insertLink.CommandText =
                "INSERT INTO links (construct_id, from_local_id, to_local_id, plug_type, from_plug, to_plug) " +
                "VALUES ($constructId, $fromLocalId, $toLocalId, $plugType, $fromPlug, $toPlug)";

            foreach (var link in links)
            {
                if (!context.ElementsById.TryGetValue(link.fromElementId, out var fromElement))
                {
                    continue;
                }

                if (!context.ElementsById.TryGetValue(link.toElementId, out var toElement))
                {
                    continue;
                }

                insertLink.Parameters.Clear();
                insertLink.Parameters.AddWithValue("$constructId", (long)(ulong)context.ConstructId);
                insertLink.Parameters.AddWithValue("$fromLocalId", (long)fromElement.localId);
                insertLink.Parameters.AddWithValue("$toLocalId", (long)toElement.localId);
                insertLink.Parameters.AddWithValue("$plugType", link.plugType.ToString());
                insertLink.Parameters.AddWithValue("$fromPlug", link.fromPlug);
                insertLink.Parameters.AddWithValue("$toPlug", link.toPlug);
                insertLink.ExecuteNonQuery();
            }
        }

        transaction.Commit();
    }

    private SqliteConnection OpenConstructIndexConnection()
    {
        Directory.CreateDirectory(mcpBridgeStateDirectory);
        var connection = new SqliteConnection("Data Source=" + GetConstructIndexDatabasePath());
        connection.Open();
        EnsureConstructIndexSchema(connection);
        return connection;
    }

    private void EnsureConstructIndexSchema(SqliteConnection connection)
    {
        if (constructIndexSchemaReady)
        {
            return;
        }

        lock (constructIndexSchemaGate)
        {
            if (constructIndexSchemaReady)
            {
                return;
            }

            using var command = connection.CreateCommand();
            command.CommandText = @"
CREATE TABLE IF NOT EXISTS constructs (
    construct_id INTEGER PRIMARY KEY,
    construct_name TEXT NOT NULL,
    owner_player_id INTEGER NULL,
    owner_organization_id INTEGER NULL,
    refreshed_at_utc TEXT NOT NULL,
    element_count INTEGER NOT NULL,
    link_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS elements (
    construct_id INTEGER NOT NULL,
    local_id INTEGER NOT NULL,
    element_id INTEGER NOT NULL,
    element_type_id INTEGER NOT NULL,
    type_name TEXT NOT NULL,
    category TEXT NOT NULL,
    custom_name TEXT NULL,
    display_name TEXT NOT NULL,
    normalized_display_name TEXT NOT NULL,
    normalized_custom_name TEXT NULL,
    normalized_type_name TEXT NOT NULL,
    semantic_text TEXT NOT NULL,
    semantic_item_type_id INTEGER NULL,
    semantic_item_name TEXT NULL,
    semantic_item_class TEXT NULL,
    industry_family TEXT NULL,
    industry_tier INTEGER NULL,
    is_industry INTEGER NOT NULL,
    is_transfer_unit INTEGER NOT NULL,
    is_container INTEGER NOT NULL,
    storage_output_mode TEXT NULL,
    hub_local_id INTEGER NULL,
    position_x REAL NULL,
    position_y REAL NULL,
    position_z REAL NULL,
    incoming_link_count INTEGER NOT NULL,
    outgoing_link_count INTEGER NOT NULL,
    PRIMARY KEY (construct_id, local_id),
    FOREIGN KEY (construct_id) REFERENCES constructs (construct_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS links (
    construct_id INTEGER NOT NULL,
    from_local_id INTEGER NOT NULL,
    to_local_id INTEGER NOT NULL,
    plug_type TEXT NOT NULL,
    from_plug INTEGER NOT NULL,
    to_plug INTEGER NOT NULL,
    PRIMARY KEY (construct_id, from_local_id, to_local_id, plug_type, from_plug, to_plug),
    FOREIGN KEY (construct_id) REFERENCES constructs (construct_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_elements_construct_category ON elements (construct_id, category);
CREATE INDEX IF NOT EXISTS idx_elements_construct_industry ON elements (construct_id, industry_family, industry_tier);
CREATE INDEX IF NOT EXISTS idx_elements_construct_semantic_item ON elements (construct_id, semantic_item_type_id, semantic_item_class);
CREATE INDEX IF NOT EXISTS idx_elements_construct_display ON elements (construct_id, normalized_display_name);
CREATE INDEX IF NOT EXISTS idx_elements_construct_semantic_text ON elements (construct_id, semantic_text);
CREATE INDEX IF NOT EXISTS idx_links_construct_from ON links (construct_id, from_local_id);
CREATE INDEX IF NOT EXISTS idx_links_construct_to ON links (construct_id, to_local_id);
";
            command.ExecuteNonQuery();
            using var indexCommand = connection.CreateCommand();
            indexCommand.CommandText =
                "CREATE INDEX IF NOT EXISTS idx_elements_construct_storage_mode ON elements (construct_id, storage_output_mode, hub_local_id);" +
                "CREATE INDEX IF NOT EXISTS idx_elements_construct_position ON elements (construct_id, position_x, position_y, position_z);";
            indexCommand.ExecuteNonQuery();
            constructIndexSchemaReady = true;
        }
    }

    private string GetConstructIndexDatabasePath()
    {
        return Path.Combine(mcpBridgeStateDirectory, ConstructIndexDatabaseFileName);
    }

    private IReadOnlyList<ConstructIndexSemanticItemDefinition> GetConstructIndexSemanticItems()
    {
        if (constructIndexSemanticItems is not null)
        {
            return constructIndexSemanticItems;
        }

        lock (constructIndexSemanticItemsGate)
        {
            if (constructIndexSemanticItems is not null)
            {
                return constructIndexSemanticItems;
            }

            var bank = services.GetRequiredService<IGameplayBank>();
            constructIndexSemanticItems = bank.GetInventoryDefinitions()
                .Where(definition => definition.BaseObject is BaseItem)
                .Select(definition =>
                {
                    var normalized = NormalizeConstructIndexText(definition.Name);
                    if (string.IsNullOrWhiteSpace(normalized))
                    {
                        return null;
                    }

                    return new ConstructIndexSemanticItemDefinition
                    {
                        ItemTypeId = definition.Id,
                        ItemName = definition.Name,
                        NormalizedItemName = normalized,
                        NormalizedNeedle = " " + normalized + " ",
                        ItemClass = ResolveConstructIndexItemClass(definition.BaseObject)
                    };
                })
                .Where(entry => entry is not null)
                .Cast<ConstructIndexSemanticItemDefinition>()
                .OrderByDescending(entry => entry.NormalizedItemName.Length)
                .ThenBy(entry => entry.ItemName, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return constructIndexSemanticItems;
        }
    }

    private ConstructIndexSemanticItemDefinition? ResolveConstructIndexSemanticItem(IReadOnlyList<ConstructIndexSemanticItemDefinition> items, string semanticText)
    {
        if (string.IsNullOrWhiteSpace(semanticText))
        {
            return null;
        }

        var haystack = " " + semanticText + " ";
        foreach (var item in items)
        {
            if (haystack.Contains(item.NormalizedNeedle, StringComparison.Ordinal))
            {
                return item;
            }
        }

        return null;
    }

    private ConstructIndexSemanticItemDefinition? ResolveConstructIndexSemanticItemForElement(
        IReadOnlyList<ConstructIndexSemanticItemDefinition> items,
        string displayName,
        string? customName,
        string typeName,
        bool isContainer)
    {
        var nameText = NormalizeConstructIndexText(string.IsNullOrWhiteSpace(customName) ? displayName : customName);
        if (isContainer)
        {
            var matchedFromName = ResolveConstructIndexSemanticItem(items, nameText);
            if (matchedFromName is not null)
            {
                return matchedFromName;
            }

            var fallbackFromName = ResolveConstructIndexSemanticFallback(nameText);
            if (fallbackFromName is not null)
            {
                return fallbackFromName;
            }
        }

        var combinedText = NormalizeConstructIndexText((customName ?? "") + " " + typeName);
        var matchedFromCombined = ResolveConstructIndexSemanticItem(items, combinedText);
        if (matchedFromCombined is not null)
        {
            return matchedFromCombined;
        }

        if (isContainer)
        {
            return null;
        }

        return ResolveConstructIndexSemanticItem(items, NormalizeConstructIndexText(typeName));
    }

    private ConstructIndexSemanticItemDefinition? ResolveConstructIndexSemanticFallback(string semanticText)
    {
        if (string.IsNullOrWhiteSpace(semanticText))
        {
            return null;
        }

        var haystack = " " + semanticText + " ";
        foreach (var oreName in ConstructIndexKnownOreNames)
        {
            var normalized = NormalizeConstructIndexText(oreName);
            var needle = " " + normalized + " ";
            if (!haystack.Contains(needle, StringComparison.Ordinal))
            {
                continue;
            }

            return new ConstructIndexSemanticItemDefinition
            {
                ItemTypeId = 0,
                ItemName = oreName,
                NormalizedItemName = normalized,
                NormalizedNeedle = needle,
                ItemClass = "ore"
            };
        }

        return null;
    }

    private string ResolveConstructIndexItemClass(object? baseObject)
    {
        if (baseObject is OreMaterial || baseObject is MineableMaterial)
        {
            return "ore";
        }

        if (baseObject is PureMaterial)
        {
            return "pure";
        }

        if (baseObject is RefinedMaterial)
        {
            return "refined";
        }

        if (baseObject is RawMaterial)
        {
            return "raw";
        }

        if (baseObject is Material)
        {
            return "material";
        }

        return "item";
    }

    private string? ResolveConstructIndexIndustryFamily(ElementInfo element, string typeName)
    {
        var broadKind = ResolveIndustryKind(element);
        if (string.Equals(broadKind, "transfer", StringComparison.OrdinalIgnoreCase))
        {
            return "transfer";
        }

        if (!string.Equals(broadKind, "industry", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var normalized = NormalizeConstructIndexText(typeName);
        if (normalized.Contains("refiner", StringComparison.Ordinal))
        {
            return "refiner";
        }

        if (normalized.Contains("smelter", StringComparison.Ordinal))
        {
            return "smelter";
        }

        if (normalized.Contains("glass", StringComparison.Ordinal))
        {
            return "glass";
        }

        if (normalized.Contains("chemical", StringComparison.Ordinal))
        {
            return "chemical";
        }

        if (normalized.Contains("assembly", StringComparison.Ordinal))
        {
            return "assembly";
        }

        if (normalized.Contains("metalwork", StringComparison.Ordinal))
        {
            return "metalwork";
        }

        if (normalized.Contains("electronics", StringComparison.Ordinal))
        {
            return "electronics";
        }

        if (normalized.Contains("printer", StringComparison.Ordinal))
        {
            return "printer";
        }

        if (normalized.Contains("honeycomb", StringComparison.Ordinal))
        {
            return "honeycomb";
        }

        return "industry";
    }

    private int? ResolveConstructIndexIndustryTier(ElementInfo element, string typeName)
    {
        if (!string.Equals(ResolveIndustryKind(element), "industry", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var trailingDigits = new string(typeName.Reverse().TakeWhile(char.IsDigit).Reverse().ToArray());
        if (!string.IsNullOrWhiteSpace(trailingDigits) &&
            int.TryParse(trailingDigits, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedTier) &&
            parsedTier > 0)
        {
            return parsedTier;
        }

        return typeName.StartsWith("Industry", StringComparison.OrdinalIgnoreCase) ? 1 : null;
    }

    private static string NormalizeConstructIndexText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        var chars = value.Trim().ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : ' ').ToArray();
        return string.Join(" ", new string(chars).Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
    }

    private static string NormalizeConstructIndexItemClass(string? value)
    {
        var normalized = NormalizeConstructIndexText(value);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return "";
        }

        if (string.Equals(normalized, "product", StringComparison.OrdinalIgnoreCase))
        {
            return "refined";
        }

        return normalized;
    }

    private static List<string> ReadStringTokenList(JToken? token)
    {
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return new List<string>();
        }

        if (token is JArray array)
        {
            return array
                .Values<string>()
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim())
                .ToList();
        }

        if (token.Type == JTokenType.String)
        {
            var raw = token.Value<string>()?.Trim();
            return string.IsNullOrWhiteSpace(raw)
                ? new List<string>()
                : new List<string> { raw! };
        }

        return new List<string>();
    }

    private ulong ResolveConstructIndexFocusLocalId(SqliteConnection connection, ulong constructId, ulong? requestedLocalId, string? requestedName)
    {
        if (requestedLocalId.HasValue && requestedLocalId.Value > 0)
        {
            return requestedLocalId.Value;
        }

        using var command = connection.CreateCommand();
        command.CommandText = "SELECT local_id, display_name, type_name, category FROM elements WHERE construct_id = $constructId AND ((custom_name IS NOT NULL AND custom_name = $name) OR type_name = $name) ORDER BY local_id LIMIT 21";
        command.Parameters.AddWithValue("$constructId", (long)constructId);
        command.Parameters.AddWithValue("$name", requestedName ?? "");
        var matches = new List<JObject>();
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                matches.Add(new JObject
                {
                    ["id"] = reader.GetInt64(0),
                    ["label"] = reader.GetString(1),
                    ["typeName"] = reader.GetString(2),
                    ["category"] = reader.GetString(3)
                });
            }
        }

        if (matches.Count == 0)
        {
            throw new ToolboxOpsException("construct_index_target_not_found");
        }

        if (matches.Count > 1)
        {
            throw new ToolboxOpsException(
                "construct_index_target_ambiguous",
                new JObject
                {
                    ["candidates"] = new JArray(matches)
                });
        }

        return (ulong)matches[0]["id"]!.Value<long>();
    }

    private List<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> LoadConstructIndexLinks(SqliteConnection connection, ulong constructId)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT from_local_id, to_local_id, plug_type, from_plug, to_plug FROM links WHERE construct_id = $constructId";
        command.Parameters.AddWithValue("$constructId", (long)constructId);
        var links = new List<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            links.Add(((ulong)reader.GetInt64(0), (ulong)reader.GetInt64(1), reader.GetString(2), reader.GetInt32(3), reader.GetInt32(4)));
        }

        return links;
    }

    private Dictionary<ulong, ConstructIndexElementRow> LoadAllConstructIndexNodes(SqliteConnection connection, ulong constructId)
    {
        using var command = connection.CreateCommand();
        command.Parameters.AddWithValue("$constructId", (long)constructId);
        command.CommandText =
            "SELECT local_id, element_id, element_type_id, type_name, category, custom_name, display_name, semantic_item_type_id, semantic_item_name, semantic_item_class, industry_family, industry_tier, is_industry, is_transfer_unit, is_container, storage_output_mode, hub_local_id, position_x, position_y, position_z, incoming_link_count, outgoing_link_count " +
            "FROM elements WHERE construct_id = $constructId";
        var result = new Dictionary<ulong, ConstructIndexElementRow>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var row = new ConstructIndexElementRow
            {
                LocalId = (ulong)reader.GetInt64(0),
                ElementId = (ulong)reader.GetInt64(1),
                ElementTypeId = (ulong)reader.GetInt64(2),
                TypeName = reader.GetString(3),
                Category = reader.GetString(4),
                CustomName = reader.IsDBNull(5) ? null : reader.GetString(5),
                DisplayName = reader.GetString(6),
                SemanticItemTypeId = reader.IsDBNull(7) ? null : (ulong?)reader.GetInt64(7),
                SemanticItemName = reader.IsDBNull(8) ? null : reader.GetString(8),
                SemanticItemClass = reader.IsDBNull(9) ? null : reader.GetString(9),
                IndustryFamily = reader.IsDBNull(10) ? null : reader.GetString(10),
                IndustryTier = reader.IsDBNull(11) ? null : (int?)reader.GetInt32(11),
                IsIndustry = reader.GetInt32(12) != 0,
                IsTransferUnit = reader.GetInt32(13) != 0,
                IsContainer = reader.GetInt32(14) != 0,
                StorageOutputMode = reader.IsDBNull(15) ? null : reader.GetString(15),
                HubLocalId = reader.IsDBNull(16) ? null : (ulong?)reader.GetInt64(16),
                PositionX = reader.IsDBNull(17) ? null : (double?)reader.GetDouble(17),
                PositionY = reader.IsDBNull(18) ? null : (double?)reader.GetDouble(18),
                PositionZ = reader.IsDBNull(19) ? null : (double?)reader.GetDouble(19),
                IncomingLinkCount = reader.GetInt32(20),
                OutgoingLinkCount = reader.GetInt32(21)
            };
            result[row.LocalId] = row;
        }

        return result;
    }

    private IEnumerable<ulong> EnumerateNeighborLocalIds(IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> links, ulong focusLocalId)
    {
        foreach (var link in links)
        {
            if (link.FromLocalId == focusLocalId)
            {
                yield return link.ToLocalId;
            }
            else if (link.ToLocalId == focusLocalId)
            {
                yield return link.FromLocalId;
            }
        }
    }

    private Dictionary<ulong, ConstructIndexElementRow> LoadConstructIndexNodes(SqliteConnection connection, ulong constructId, IReadOnlyCollection<ulong> localIds)
    {
        var result = new Dictionary<ulong, ConstructIndexElementRow>();
        if (localIds.Count == 0)
        {
            return result;
        }

        using var command = connection.CreateCommand();
        var placeholders = new List<string>(localIds.Count);
        var index = 0;
        foreach (var localId in localIds)
        {
            var parameterName = "$localId" + index.ToString(CultureInfo.InvariantCulture);
            placeholders.Add(parameterName);
            command.Parameters.AddWithValue(parameterName, (long)localId);
            index += 1;
        }

        command.Parameters.AddWithValue("$constructId", (long)constructId);
        command.CommandText =
            "SELECT local_id, element_id, element_type_id, type_name, category, custom_name, display_name, semantic_item_type_id, semantic_item_name, semantic_item_class, industry_family, industry_tier, is_industry, is_transfer_unit, is_container, storage_output_mode, hub_local_id, position_x, position_y, position_z, incoming_link_count, outgoing_link_count " +
            "FROM elements WHERE construct_id = $constructId AND local_id IN (" + string.Join(", ", placeholders) + ")";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var row = new ConstructIndexElementRow
            {
                LocalId = (ulong)reader.GetInt64(0),
                ElementId = (ulong)reader.GetInt64(1),
                ElementTypeId = (ulong)reader.GetInt64(2),
                TypeName = reader.GetString(3),
                Category = reader.GetString(4),
                CustomName = reader.IsDBNull(5) ? null : reader.GetString(5),
                DisplayName = reader.GetString(6),
                SemanticItemTypeId = reader.IsDBNull(7) ? null : (ulong?)reader.GetInt64(7),
                SemanticItemName = reader.IsDBNull(8) ? null : reader.GetString(8),
                SemanticItemClass = reader.IsDBNull(9) ? null : reader.GetString(9),
                IndustryFamily = reader.IsDBNull(10) ? null : reader.GetString(10),
                IndustryTier = reader.IsDBNull(11) ? null : (int?)reader.GetInt32(11),
                IsIndustry = reader.GetInt32(12) != 0,
                IsTransferUnit = reader.GetInt32(13) != 0,
                IsContainer = reader.GetInt32(14) != 0,
                StorageOutputMode = reader.IsDBNull(15) ? null : reader.GetString(15),
                HubLocalId = reader.IsDBNull(16) ? null : (ulong?)reader.GetInt64(16),
                PositionX = reader.IsDBNull(17) ? null : (double?)reader.GetDouble(17),
                PositionY = reader.IsDBNull(18) ? null : (double?)reader.GetDouble(18),
                PositionZ = reader.IsDBNull(19) ? null : (double?)reader.GetDouble(19),
                IncomingLinkCount = reader.GetInt32(20),
                OutgoingLinkCount = reader.GetInt32(21)
            };
            result[row.LocalId] = row;
        }

        return result;
    }

    private static bool IsConstructIndexStorageNode(ConstructIndexElementRow node)
    {
        return string.Equals(node.Category, "container", StringComparison.OrdinalIgnoreCase)
            || string.Equals(node.Category, "container_hub", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsConstructIndexIndustryConsumerNode(ConstructIndexElementRow node, string? requestedIndustryFamily)
    {
        if (!node.IsIndustry && string.IsNullOrWhiteSpace(node.IndustryFamily))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(requestedIndustryFamily))
        {
            return true;
        }

        return string.Equals(node.IndustryFamily, NormalizeConstructIndexText(requestedIndustryFamily), StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsConstructIndexTransferNode(ConstructIndexElementRow node)
    {
        return string.Equals(node.IndustryFamily, "transfer", StringComparison.OrdinalIgnoreCase)
            || string.Equals(node.TypeName, "TransferUnit", StringComparison.OrdinalIgnoreCase);
    }

    private static ConstructIndexElementRow ResolveIndustrySupportRefillTargetNode(
        ConstructIndexElementRow supportNode,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId)
    {
        if (string.Equals(supportNode.StorageOutputMode, "hub", StringComparison.OrdinalIgnoreCase)
            && supportNode.HubLocalId.HasValue
            && nodesByLocalId.TryGetValue(supportNode.HubLocalId.Value, out var hubNode))
        {
            return hubNode;
        }

        return supportNode;
    }

    private JObject BuildConstructIndexElementObject(ConstructIndexElementRow node, bool includePosition = false)
    {
        var result = new JObject
        {
            ["id"] = node.LocalId,
            ["elementTypeId"] = node.ElementTypeId,
            ["name"] = string.IsNullOrWhiteSpace(node.CustomName) ? JValue.CreateNull() : node.CustomName,
            ["label"] = node.DisplayName,
            ["typeName"] = node.TypeName,
            ["category"] = node.Category,
            ["itemTypeId"] = node.SemanticItemTypeId.HasValue ? new JValue(node.SemanticItemTypeId.Value) : JValue.CreateNull(),
            ["itemName"] = string.IsNullOrWhiteSpace(node.SemanticItemName) ? JValue.CreateNull() : node.SemanticItemName,
            ["itemClass"] = string.IsNullOrWhiteSpace(node.SemanticItemClass) ? JValue.CreateNull() : node.SemanticItemClass,
            ["industryFamily"] = string.IsNullOrWhiteSpace(node.IndustryFamily) ? JValue.CreateNull() : node.IndustryFamily,
            ["industryTier"] = node.IndustryTier.HasValue ? new JValue(node.IndustryTier.Value) : JValue.CreateNull(),
            ["storageOutputMode"] = string.IsNullOrWhiteSpace(node.StorageOutputMode) ? JValue.CreateNull() : node.StorageOutputMode,
            ["hubId"] = node.HubLocalId.HasValue ? new JValue(node.HubLocalId.Value) : JValue.CreateNull()
        };

        if (includePosition)
        {
            result["position"] = BuildConstructIndexPositionObject(node);
        }

        return result;
    }

    private JArray BuildConstructIndexNodeArray(IEnumerable<ulong> localIds, IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId)
    {
        return new JArray(
            localIds
                .Distinct()
                .Where(nodesByLocalId.ContainsKey)
                .Select(localId => nodesByLocalId[localId])
                .OrderBy(node => node.DisplayName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(node => node.LocalId)
                .Select(node => BuildConstructIndexElementObject(node)));
    }

    private JObject BuildConstructIndexLinkObject(
        (ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug) link,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId)
    {
        return new JObject
        {
            ["fromId"] = link.FromLocalId,
            ["toId"] = link.ToLocalId,
            ["plugType"] = link.PlugType,
            ["fromPlug"] = link.FromPlug,
            ["toPlug"] = link.ToPlug,
            ["edgeType"] = ResolveConstructIndexLinkEdgeType(link, nodesByLocalId)
        };
    }

    private string ResolveConstructIndexLinkEdgeType(
        (ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug) link,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId)
    {
        nodesByLocalId.TryGetValue(link.FromLocalId, out var fromNode);
        nodesByLocalId.TryGetValue(link.ToLocalId, out var toNode);
        if (fromNode is null || toNode is null)
        {
            return "link";
        }

        if (fromNode.IsIndustry && IsConstructIndexStorageNode(toNode))
        {
            return "industry_output_to_storage";
        }

        if (IsConstructIndexStorageNode(fromNode) && toNode.IsIndustry)
        {
            return "storage_to_industry_input";
        }

        if (IsConstructIndexStorageNode(fromNode) && IsConstructIndexTransferNode(toNode))
        {
            return "storage_to_transfer_input";
        }

        if (IsConstructIndexTransferNode(fromNode) && IsConstructIndexStorageNode(toNode))
        {
            return "transfer_output_to_storage";
        }

        if (IsConstructIndexStorageNode(fromNode)
            && string.Equals(toNode.Category, "container_hub", StringComparison.OrdinalIgnoreCase))
        {
            return "hub_child";
        }

        if (string.Equals(fromNode.Category, "container_hub", StringComparison.OrdinalIgnoreCase)
            && IsConstructIndexStorageNode(toNode))
        {
            return "hub_parent";
        }

        return NormalizeConstructIndexText(fromNode.Category + "_to_" + toNode.Category);
    }

    private JObject BuildConstructIndexNearbyElementObject(ConstructIndexElementRow node, double distanceMeters, double dx, double dy, double dz)
    {
        var result = BuildConstructIndexElementObject(node, includePosition: true);
        result["distanceMeters"] = Math.Round(distanceMeters, 3);
        result["delta"] = new JObject
        {
            ["x"] = Math.Round(dx, 3),
            ["y"] = Math.Round(dy, 3),
            ["z"] = Math.Round(dz, 3)
        };
        return result;
    }

    private JObject BuildConstructIndexPositionObject(ConstructIndexElementRow node)
    {
        if (!node.PositionX.HasValue || !node.PositionY.HasValue || !node.PositionZ.HasValue)
        {
            return new JObject
            {
                ["x"] = JValue.CreateNull(),
                ["y"] = JValue.CreateNull(),
                ["z"] = JValue.CreateNull()
            };
        }

        return new JObject
        {
            ["x"] = node.PositionX.Value,
            ["y"] = node.PositionY.Value,
            ["z"] = node.PositionZ.Value
        };
    }

    private async Task<JObject> BuildIndustrySupportFeederRuntimeObject(ConstructIndexElementRow feederNode)
    {
        var runtime = await ReadIndustryRuntimePayload(feederNode.ElementId);
        return new JObject
        {
            ["available"] = runtime["available"]?.Value<bool>() == true,
            ["error"] = runtime["error"] ?? JValue.CreateNull(),
            ["state"] = runtime["state"] ?? JValue.CreateNull(),
            ["recipeId"] = runtime["recipeId"] ?? JValue.CreateNull(),
            ["nextRecipeId"] = runtime["nextRecipeId"] ?? JValue.CreateNull(),
            ["productItemTypeId"] = runtime["productItemTypeId"] ?? JValue.CreateNull(),
            ["productItemName"] = runtime["productItemName"] ?? JValue.CreateNull(),
            ["maintainQuantity"] = runtime["maintainQuantity"] ?? JValue.CreateNull(),
            ["currentQuantity"] = runtime["currentQuantity"] ?? JValue.CreateNull(),
            ["batchesRequested"] = runtime["batchesRequested"] ?? JValue.CreateNull()
        };
    }

    private async Task<(HashSet<ulong> ProducerTypeIds, HashSet<ulong> RecipeIds)> ResolveConstructIndexProducerTypesForProductName(string itemName)
    {
        return await ResolveConstructIndexProducerTypesFromEmbeddedReferences(
            ResolveEmbeddedIndustryRecipeReferencesByProductName(itemName));
    }

    private async Task<(HashSet<ulong> ProducerTypeIds, HashSet<ulong> RecipeIds)> ResolveConstructIndexProducerTypesForIngredientName(string itemName)
    {
        return await ResolveConstructIndexProducerTypesFromEmbeddedReferences(
            ResolveEmbeddedIndustryRecipeReferencesByIngredientName(itemName));
    }

    private async Task<(HashSet<ulong> ProducerTypeIds, HashSet<ulong> RecipeIds)> ResolveConstructIndexProducerTypesFromEmbeddedReferences(
        IEnumerable<EmbeddedIndustryRecipeReference> references)
    {
        var producerTypeIds = new HashSet<ulong>();
        var recipeIds = new HashSet<ulong>();
        var recipes = services.GetRequiredService<IRecipes>();

        foreach (var reference in references
            .Where(entry => entry.RecipeId > 0)
            .GroupBy(entry => entry.RecipeId)
            .Select(group => group.First())
            .OrderBy(entry => entry.RecipeId))
        {
            var recipe = await recipes.GetRecipe(reference.RecipeId);
            if (recipe is null)
            {
                continue;
            }

            recipeIds.Add(recipe.id);
            foreach (var producerTypeId in recipe.producers ?? new List<ulong>())
            {
                producerTypeIds.Add(producerTypeId);
            }
        }

        return (producerTypeIds, recipeIds);
    }

    private static HashSet<ulong>? IntersectConstructIndexProducerTypeFilters(HashSet<ulong>? first, HashSet<ulong>? second)
    {
        if (first is null)
        {
            return second;
        }

        if (second is null)
        {
            return first;
        }

        var intersection = new HashSet<ulong>(first);
        intersection.IntersectWith(second);
        return intersection;
    }

    private static List<ulong> ResolveConstructIndexBranchStorageAnchorIds(
        ConstructIndexElementRow focusNode,
        IReadOnlyCollection<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> allLinks,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId)
    {
        if (IsConstructIndexStorageNode(focusNode))
        {
            return new List<ulong> { focusNode.LocalId };
        }

        return EnumerateConstructIndexOutgoingNodeIds(allLinks, focusNode.LocalId, nodesByLocalId, IsConstructIndexStorageNode)
            .Concat(EnumerateConstructIndexIncomingNodeIds(allLinks, focusNode.LocalId, nodesByLocalId, IsConstructIndexStorageNode))
            .Distinct()
            .OrderBy(localId => localId)
            .ToList();
    }

    private static IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> EnumerateConstructIndexIncomingLinks(
        IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> links,
        ulong localId)
    {
        return links.Where(link => link.ToLocalId == localId);
    }

    private static IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> EnumerateConstructIndexOutgoingLinks(
        IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> links,
        ulong localId)
    {
        return links.Where(link => link.FromLocalId == localId);
    }

    private static IEnumerable<ulong> EnumerateConstructIndexIncomingNodeIds(
        IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> links,
        ulong localId,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId,
        Func<ConstructIndexElementRow, bool>? predicate = null)
    {
        predicate ??= _ => true;
        return EnumerateConstructIndexIncomingLinks(links, localId)
            .Select(link => link.FromLocalId)
            .Where(nodesByLocalId.ContainsKey)
            .Where(localIdValue => predicate(nodesByLocalId[localIdValue]))
            .Distinct();
    }

    private static IEnumerable<ulong> EnumerateConstructIndexOutgoingNodeIds(
        IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> links,
        ulong localId,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId,
        Func<ConstructIndexElementRow, bool>? predicate = null)
    {
        predicate ??= _ => true;
        return EnumerateConstructIndexOutgoingLinks(links, localId)
            .Select(link => link.ToLocalId)
            .Where(nodesByLocalId.ContainsKey)
            .Where(localIdValue => predicate(nodesByLocalId[localIdValue]))
            .Distinct();
    }

    private static string? ResolveConstructIndexTraceStopReason(ConstructIndexElementRow node, string? stopAtItemClass, string? stopAtIndustryFamily)
    {
        if (!string.IsNullOrWhiteSpace(stopAtItemClass)
            && string.Equals(node.SemanticItemClass, stopAtItemClass, StringComparison.OrdinalIgnoreCase))
        {
            return "item_class:" + stopAtItemClass;
        }

        if (!string.IsNullOrWhiteSpace(stopAtIndustryFamily)
            && string.Equals(node.IndustryFamily, stopAtIndustryFamily, StringComparison.OrdinalIgnoreCase))
        {
            return "industry_family:" + stopAtIndustryFamily;
        }

        return null;
    }

    private static int ResolveConstructIndexDirectionalDegree(
        IEnumerable<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> links,
        ulong localId,
        string direction)
    {
        return string.Equals(direction, "downstream", StringComparison.OrdinalIgnoreCase)
            ? EnumerateConstructIndexOutgoingLinks(links, localId).Select(link => link.ToLocalId).Distinct().Count()
            : EnumerateConstructIndexIncomingLinks(links, localId).Select(link => link.FromLocalId).Distinct().Count();
    }

    private static string NormalizeConstructIndexBankGroupBy(string? value)
    {
        var normalized = NormalizeConstructIndexText(value);
        return normalized switch
        {
            "none" => "none",
            "shared input support pattern" => "shared_input_support_pattern",
            _ => "shared_output_storage"
        };
    }

    private static IEnumerable<ulong> ResolveConstructIndexBankMemberIds(
        ConstructIndexElementRow prototypeNode,
        IReadOnlyCollection<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> allLinks,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId,
        string groupBy)
    {
        var sameRoleNodes = nodesByLocalId.Values
            .Where(node =>
                node.Category == prototypeNode.Category
                && string.Equals(node.TypeName, prototypeNode.TypeName, StringComparison.OrdinalIgnoreCase))
            .OrderBy(node => node.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(node => node.LocalId)
            .ToList();
        if (string.Equals(groupBy, "none", StringComparison.OrdinalIgnoreCase))
        {
            return sameRoleNodes.Select(node => node.LocalId);
        }

        if (string.Equals(groupBy, "shared_input_support_pattern", StringComparison.OrdinalIgnoreCase))
        {
            var anchorSignature = BuildConstructIndexStorageInputSignature(prototypeNode, allLinks, nodesByLocalId);
            return sameRoleNodes
                .Where(node => string.Equals(
                    BuildConstructIndexStorageInputSignature(node, allLinks, nodesByLocalId),
                    anchorSignature,
                    StringComparison.Ordinal))
                .Select(node => node.LocalId);
        }

        var anchorOutputIds = EnumerateConstructIndexOutgoingNodeIds(allLinks, prototypeNode.LocalId, nodesByLocalId, IsConstructIndexStorageNode)
            .ToHashSet();
        if (anchorOutputIds.Count == 0)
        {
            return sameRoleNodes.Select(node => node.LocalId);
        }

        return sameRoleNodes
            .Where(node => EnumerateConstructIndexOutgoingNodeIds(allLinks, node.LocalId, nodesByLocalId, IsConstructIndexStorageNode)
                .Any(anchorOutputIds.Contains))
            .Select(node => node.LocalId);
    }

    private static string BuildConstructIndexStorageInputSignature(
        ConstructIndexElementRow node,
        IReadOnlyCollection<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> allLinks,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId)
    {
        var parts = EnumerateConstructIndexIncomingNodeIds(allLinks, node.LocalId, nodesByLocalId, IsConstructIndexStorageNode)
            .Where(nodesByLocalId.ContainsKey)
            .Select(localId =>
            {
                var storageNode = nodesByLocalId[localId];
                if (!string.IsNullOrWhiteSpace(storageNode.SemanticItemName))
                {
                    return "item:" + storageNode.SemanticItemName;
                }

                if (!string.IsNullOrWhiteSpace(storageNode.SemanticItemClass))
                {
                    return "class:" + storageNode.SemanticItemClass;
                }

                return "storage:" + storageNode.DisplayName;
            })
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
            .ToList();
        return string.Join("|", parts);
    }

    private static string ResolveConstructIndexInputBranchKey(ConstructIndexElementRow node)
    {
        if (!string.IsNullOrWhiteSpace(node.SemanticItemName))
        {
            return "item:" + node.SemanticItemName;
        }

        if (!string.IsNullOrWhiteSpace(node.SemanticItemClass))
        {
            return "class:" + node.SemanticItemClass;
        }

        return "storage:" + node.DisplayName;
    }

    private static IEnumerable<ulong> ResolveConstructIndexUpstreamStorageAnchorIds(
        ulong storageLocalId,
        IReadOnlyCollection<(ulong FromLocalId, ulong ToLocalId, string PlugType, int FromPlug, int ToPlug)> allLinks,
        IReadOnlyDictionary<ulong, ConstructIndexElementRow> nodesByLocalId)
    {
        var transferIds = EnumerateConstructIndexIncomingNodeIds(allLinks, storageLocalId, nodesByLocalId, IsConstructIndexTransferNode)
            .ToList();
        if (transferIds.Count == 0)
        {
            return Enumerable.Empty<ulong>();
        }

        return transferIds
            .SelectMany(localId => EnumerateConstructIndexIncomingNodeIds(allLinks, localId, nodesByLocalId, IsConstructIndexStorageNode))
            .Distinct()
            .OrderBy(localId => localId);
    }

    private Dictionary<ulong, ConstructIndexStorageTopology> ResolveConstructIndexStorageTopologies(
        IReadOnlyCollection<ElementInfo> elements,
        IReadOnlyCollection<LinkInfo> links,
        IReadOnlyDictionary<ulong, ulong> elementLocalIdByElementId,
        IReadOnlyDictionary<ulong, string> elementCategoryByElementId)
    {
        var result = new Dictionary<ulong, ConstructIndexStorageTopology>();
        foreach (var element in elements)
        {
            if (!elementCategoryByElementId.TryGetValue(element.elementId, out var category))
            {
                continue;
            }

            var isStorage = string.Equals(category, "container", StringComparison.OrdinalIgnoreCase)
                || string.Equals(category, "container_hub", StringComparison.OrdinalIgnoreCase);
            if (!isStorage)
            {
                continue;
            }

            var outgoingItemLinks = links
                .Where(link => link.fromElementId == element.elementId && link.plugType == PlugType.PLUG_ITEM)
                .ToList();
            var outgoingHubLocalIds = outgoingItemLinks
                .Where(link => elementCategoryByElementId.TryGetValue(link.toElementId, out var targetCategory)
                    && string.Equals(targetCategory, "container_hub", StringComparison.OrdinalIgnoreCase)
                    && elementLocalIdByElementId.TryGetValue(link.toElementId, out _))
                .Select(link => elementLocalIdByElementId[link.toElementId])
                .Distinct()
                .ToList();
            var outgoingNonHubCount = outgoingItemLinks.Count(link =>
                !elementCategoryByElementId.TryGetValue(link.toElementId, out var targetCategory)
                || !string.Equals(targetCategory, "container_hub", StringComparison.OrdinalIgnoreCase));

            string storageOutputMode;
            ulong? hubLocalId = null;
            if (outgoingHubLocalIds.Count == 1 && outgoingNonHubCount == 0)
            {
                storageOutputMode = "hub";
                hubLocalId = outgoingHubLocalIds[0];
            }
            else if (outgoingHubLocalIds.Count == 0 && outgoingNonHubCount == 0)
            {
                storageOutputMode = "none";
            }
            else if (outgoingHubLocalIds.Count == 0)
            {
                storageOutputMode = "non_hub";
            }
            else
            {
                storageOutputMode = "invalid_mixed";
            }

            result[element.elementId] = new ConstructIndexStorageTopology
            {
                StorageOutputMode = storageOutputMode,
                HubLocalId = hubLocalId
            };
        }

        return result;
    }
}
