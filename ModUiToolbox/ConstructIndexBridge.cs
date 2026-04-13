using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using Backend;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;
using NQ;
using NQ.Interfaces;
using NQutils;
using NQutils.Def;

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
                .Select(link => new JObject
                {
                    ["fromId"] = link.FromLocalId,
                    ["toId"] = link.ToLocalId,
                    ["plugType"] = link.PlugType,
                    ["fromPlug"] = link.FromPlug,
                    ["toPlug"] = link.ToPlug
                }));

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
                "construct_id, local_id, element_id, element_type_id, type_name, category, custom_name, display_name, normalized_display_name, normalized_custom_name, normalized_type_name, semantic_text, semantic_item_type_id, semantic_item_name, semantic_item_class, industry_family, industry_tier, is_industry, is_transfer_unit, is_container, storage_output_mode, hub_local_id, incoming_link_count, outgoing_link_count" +
                ") VALUES (" +
                "$constructId, $localId, $elementId, $elementTypeId, $typeName, $category, $customName, $displayName, $normalizedDisplayName, $normalizedCustomName, $normalizedTypeName, $semanticText, $semanticItemTypeId, $semanticItemName, $semanticItemClass, $industryFamily, $industryTier, $isIndustry, $isTransferUnit, $isContainer, $storageOutputMode, $hubLocalId, $incomingLinkCount, $outgoingLinkCount" +
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
            EnsureConstructIndexColumn(connection, "elements", "storage_output_mode", "TEXT NULL");
            EnsureConstructIndexColumn(connection, "elements", "hub_local_id", "INTEGER NULL");
            using var indexCommand = connection.CreateCommand();
            indexCommand.CommandText = "CREATE INDEX IF NOT EXISTS idx_elements_construct_storage_mode ON elements (construct_id, storage_output_mode, hub_local_id);";
            indexCommand.ExecuteNonQuery();
            constructIndexSchemaReady = true;
        }
    }

    private void EnsureConstructIndexColumn(SqliteConnection connection, string tableName, string columnName, string columnSql)
    {
        using var pragma = connection.CreateCommand();
        pragma.CommandText = "PRAGMA table_info(" + tableName + ")";
        using var reader = pragma.ExecuteReader();
        while (reader.Read())
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        using var alter = connection.CreateCommand();
        alter.CommandText = "ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + columnSql;
        alter.ExecuteNonQuery();
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
            "SELECT local_id, element_id, element_type_id, type_name, category, custom_name, display_name, semantic_item_type_id, semantic_item_name, semantic_item_class, industry_family, industry_tier, is_industry, is_transfer_unit, is_container, storage_output_mode, hub_local_id, incoming_link_count, outgoing_link_count " +
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
                IncomingLinkCount = reader.GetInt32(17),
                OutgoingLinkCount = reader.GetInt32(18)
            };
            result[row.LocalId] = row;
        }

        return result;
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
