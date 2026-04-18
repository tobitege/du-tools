using System;
using System.Linq;
using System.Globalization;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Backend;
using Backend.Business;
using Backend.Storage;
using NQ;
using NQ.Interfaces;
using NQutils;
using NQutils.Def;
using NQutils.Sql;
using NQutils.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

sealed class ToolboxOpsException : Exception
{
    public ToolboxOpsException(string message, JObject? details = null)
        : base(message)
    {
        Details = details;
    }

    public JObject? Details { get; }
}

sealed class ResolvedToolboxStorageTarget
{
    public string StorageKind { get; set; } = "";
    public ulong RequesterPlayerId { get; set; }
    public ulong TargetPlayerId { get; set; }
    public StorageRef StorageRef { get; set; }
    public string Label { get; set; } = "";
    public ulong? ContainerElementId { get; set; }
    public ConstructInspectionContext? ConstructContext { get; set; }
    public ElementInfo? Element { get; set; }
    public bool UsedCurrentConstruct { get; set; }
}

sealed class ResolvedToolboxIndustryTarget
{
    public ulong RequesterPlayerId { get; set; }
    public ConstructInspectionContext ConstructContext { get; set; } = null!;
    public ElementInfo Element { get; set; } = null!;
    public bool UsedCurrentConstruct { get; set; }
    public string IndustryKind { get; set; } = "";
    public string Label { get; set; } = "";
}

sealed class ResolvedToolboxConstructElementTarget
{
    public ulong RequesterPlayerId { get; set; }
    public ConstructInspectionContext ConstructContext { get; set; } = null!;
    public ElementInfo Element { get; set; } = null!;
    public bool UsedCurrentConstruct { get; set; }
    public string Label { get; set; } = "";
}

sealed class ResolvedToolboxIndustryRecipe
{
    public ulong RecipeId { get; set; }
    public string RecipeKind { get; set; } = "";
    public ulong ProductItemTypeId { get; set; }
    public string ProductItemName { get; set; } = "";
    public string RecipeKey { get; set; } = "";
    public string ProductTypeKey { get; set; } = "";
    public string IndustryName { get; set; } = "";
    public string ParentGroupName { get; set; } = "";
    public Recipe? Recipe { get; set; }
}

sealed class EmbeddedIndustryRecipeReference
{
    public string RecipeKey { get; set; } = "";
    public ulong RecipeId { get; set; }
    public ulong ProductItemTypeId { get; set; }
    public string ProductTypeKey { get; set; } = "";
    public string ProductItemName { get; set; } = "";
    public string IndustryName { get; set; } = "";
    public string ParentGroupName { get; set; } = "";
    public IReadOnlyList<string> ProductNames { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> IngredientNames { get; set; } = Array.Empty<string>();
}

sealed class EmbeddedIndustryRecipeCatalog
{
    public IReadOnlyDictionary<string, EmbeddedIndustryRecipeReference> ByRecipeKey { get; set; } = new Dictionary<string, EmbeddedIndustryRecipeReference>(StringComparer.OrdinalIgnoreCase);
    public IReadOnlyDictionary<ulong, EmbeddedIndustryRecipeReference> ByRecipeId { get; set; } = new Dictionary<ulong, EmbeddedIndustryRecipeReference>();
    public IReadOnlyDictionary<ulong, EmbeddedIndustryRecipeReference> ByProductItemTypeId { get; set; } = new Dictionary<ulong, EmbeddedIndustryRecipeReference>();
    public IReadOnlyDictionary<string, IReadOnlyList<EmbeddedIndustryRecipeReference>> ByProductName { get; set; } = new Dictionary<string, IReadOnlyList<EmbeddedIndustryRecipeReference>>(StringComparer.OrdinalIgnoreCase);
    public IReadOnlyDictionary<string, IReadOnlyList<EmbeddedIndustryRecipeReference>> ByIngredientName { get; set; } = new Dictionary<string, IReadOnlyList<EmbeddedIndustryRecipeReference>>(StringComparer.OrdinalIgnoreCase);
}

sealed class IndustryBatchOperation
{
    public int Index { get; set; }
    public JObject Request { get; set; } = new JObject();
    public ResolvedToolboxIndustryTarget Target { get; set; } = null!;
    public ResolvedToolboxIndustryRecipe Recipe { get; set; } = null!;
    public string StartMode { get; set; } = "";
    public long? RequestedAmount { get; set; }
}

sealed class StorageBatchSpawnEntry
{
    public int Index { get; set; }
    public JObject Request { get; set; } = new JObject();
    public ulong ItemTypeId { get; set; }
    public string ItemName { get; set; } = "";
    public long RequestedQuantity { get; set; }
    public long RawQuantity { get; set; }
    public ItemAndQuantity Operation { get; set; }
}

public sealed partial class MyDuMod
{
    private const ulong DevCraftingSpeedTalentId = 4122735657;
    private readonly object embeddedIndustryRecipeCatalogGate = new();
    private EmbeddedIndustryRecipeCatalog? embeddedIndustryRecipeCatalog;
    private readonly ConcurrentDictionary<ulong, bool> hasDevCraftingSpeedTalentByPlayer = new();
    private readonly ConcurrentDictionary<ulong, byte> warnedDevCraftingSpeedTalentPlayers = new();

    private async Task<bool> TryProcessToolboxOpsBridgeCommand(
        string commandId,
        string targetKind,
        string action,
        JObject payload,
        ulong playerId,
        string? boardId)
    {
        if (!string.Equals(targetKind, "toolbox_ops", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.Equals(action, "probe_call", StringComparison.OrdinalIgnoreCase))
        {
            await AppendMcpBridgeEvent(
                "toolbox_ops",
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
        var resultPayload = await BuildToolboxOpsPayload(commandId, playerId, probeMethod, payload);
        await AppendMcpBridgeEvent("toolbox_ops", "toolbox_ops_result", playerId, resultPayload, boardId);

        var success = resultPayload["success"]?.Value<bool>() ?? false;
        var error = resultPayload["error"]?.Value<string>();
        await AppendMcpBridgeEvent(
            "toolbox_ops",
            "command_result",
            playerId,
            new JObject
            {
                ["commandId"] = commandId,
                ["status"] = success ? "completed" : "rejected",
                ["action"] = action,
                ["summary"] = "toolbox_ops " + probeMethod,
                ["probeMethod"] = probeMethod,
                ["reason"] = error is null ? JValue.CreateNull() : error
            },
            boardId);

        return true;
    }

    private async Task<JObject> BuildToolboxOpsPayload(string commandId, ulong playerId, string probeMethod, JObject payload)
    {
        try
        {
            switch ((probeMethod ?? "").Trim().ToLowerInvariant())
            {
                case "resolve_storage":
                    return await BuildResolveStoragePayload(commandId, playerId, payload);
                case "describe_storage":
                    return await BuildDescribeStoragePayload(commandId, playerId, payload);
                case "describe_industry_support_storage":
                    return await BuildDescribeIndustrySupportStoragePayload(commandId, playerId, payload);
                case "spawn_item":
                    return await BuildSpawnOrTakePayload(commandId, playerId, payload, isTake: false);
                case "spawn_item_batch":
                    return await BuildSpawnBatchPayload(commandId, playerId, payload);
                case "take_item":
                    return await BuildSpawnOrTakePayload(commandId, playerId, payload, isTake: true);
                case "move_slot":
                    return await BuildMoveSlotPayload(commandId, playerId, payload);
                case "drop_slot":
                    return await BuildDropSlotPayload(commandId, playerId, payload);
                case "rename_element_batch":
                    return await BuildRenameElementBatchPayload(commandId, playerId, payload);
                case "player_position":
                    return await BuildPlayerPositionPayload(commandId, playerId);
                case "element_add":
                    return await BuildElementAddPayload(commandId, playerId, payload);
                case "element_delete":
                    return await BuildElementDeleteOrDestroyPayload(commandId, playerId, payload, destroy: false);
                case "element_destroy":
                    return await BuildElementDeleteOrDestroyPayload(commandId, playerId, payload, destroy: true);
                case "element_replace":
                    return await BuildElementReplacePayload(commandId, playerId, payload);
                case "element_link_create":
                    return await BuildElementLinkPayload(commandId, playerId, payload, create: true);
                case "element_link_delete":
                    return await BuildElementLinkPayload(commandId, playerId, payload, create: false);
                case "refresh_construct_index":
                    return await BuildRefreshConstructIndexPayload(commandId, playerId, payload);
                case "construct_runtime_availability":
                    return await BuildConstructRuntimeAvailabilityPayload(commandId, playerId, payload);
                case "query_construct_index":
                    return await BuildQueryConstructIndexPayload(commandId, playerId, payload);
                case "related_construct_index":
                    return await BuildRelatedConstructIndexPayload(commandId, playerId, payload);
                case "nearby_construct_index":
                    return await BuildNearbyConstructIndexPayload(commandId, playerId, payload);
                case "describe_industry_branch":
                    return await BuildDescribeIndustryBranchPayload(commandId, playerId, payload);
                case "trace_construct_index":
                    return await BuildTraceConstructIndexPayload(commandId, playerId, payload);
                case "describe_bank_from_anchor":
                    return await BuildDescribeBankFromAnchorPayload(commandId, playerId, payload);
                case "describe_consumer_bank_branches":
                    return await BuildDescribeConsumerBankBranchesPayload(commandId, playerId, payload);
                case "describe_industry_supports":
                    return await BuildDescribeIndustrySupportsPayload(commandId, playerId, payload);
                case "resolve_industry_recipe":
                    return await BuildResolveIndustryRecipePayload(commandId, playerId, payload);
                case "describe_industry_batch":
                    return await BuildDescribeIndustryBatchPayload(commandId, playerId, payload);
                case "industry_stop":
                    return await BuildIndustryStopPayload(commandId, playerId, payload);
                case "industry_set_recipe":
                    return await BuildIndustrySetRecipePayload(commandId, playerId, payload);
                case "industry_start":
                    return await BuildIndustryStartPayload(commandId, playerId, payload);
                case "industry_configure_batch":
                    return await BuildIndustryConfigureBatchPayload(commandId, playerId, payload);
                case "query_item_bank":
                    return await Task.FromResult(BuildQueryItemBankPayload(commandId, playerId, payload));
                case "list_item_bank_groups":
                    return await Task.FromResult(BuildListItemBankGroupsPayload(commandId, playerId, payload));
                default:
                    return CreateToolboxOpsFailure(commandId, probeMethod, "unsupported_probe_method");
            }
        }
        catch (ToolboxOpsException ex)
        {
            return CreateToolboxOpsFailure(commandId, probeMethod, ex.Message, ex.Details);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIToolbox toolbox_ops failed for method {ProbeMethod}", probeMethod);
            return CreateToolboxOpsFailure(commandId, probeMethod, ex.Message);
        }
    }

    private async Task<JObject> BuildResolveStoragePayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0);
        var resolved = await ResolveStorageTarget(requesterPlayerId, selector);
        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "resolve_storage",
            ["storage"] = BuildResolvedStorageObject(resolved)
        };
    }

    private async Task<JObject> BuildDescribeStoragePayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var itemLimit = ReadClampedProbeArgInt32(probeArgs, 1, 100, 1, 500);
        var batchEntries = selector?["entries"] as JArray;
        if (batchEntries is not null && batchEntries.Count > 0)
        {
            var results = new JObject[batchEntries.Count];

            for (var index = 0; index < batchEntries.Count; index++)
            {
                if (batchEntries[index] is not JObject entry)
                {
                    results[index] = CreateDescribeStorageEntryFailure(
                        index,
                        "storage_batch_entry_invalid");
                    continue;
                }

                try
                {
                    var batchResolved = await ResolveStorageTarget(requesterPlayerId, entry);
                    var batchStorageService = services.GetRequiredService<IItemStorageService>();
                    var batchStorage = await batchStorageService.Get(batchResolved.StorageRef, (PlayerId)requesterPlayerId);
                    results[index] = new JObject
                    {
                        ["index"] = index,
                        ["success"] = true,
                        ["error"] = JValue.CreateNull(),
                        ["storage"] = BuildResolvedStorageObject(batchResolved),
                        ["snapshot"] = BuildStorageSnapshot(batchStorage, ResolveResolvedStorageCategory(batchResolved), itemLimit),
                        ["candidates"] = new JArray()
                    };
                }
                catch (ToolboxOpsException ex)
                {
                    results[index] = CreateDescribeStorageEntryFailure(index, ex.Message, ex.Details);
                }
                catch (Exception ex)
                {
                    results[index] = CreateDescribeStorageEntryFailure(index, ex.Message);
                }
            }

            var successCount = results.Count(result => result["success"]?.Value<bool>() == true);
            var failedCount = results.Length - successCount;
            return new JObject
            {
                ["commandId"] = commandId,
                ["success"] = failedCount == 0,
                ["error"] = failedCount == 0 ? JValue.CreateNull() : "storage_batch_contains_failures",
                ["method"] = "describe_storage",
                ["storage"] = JValue.CreateNull(),
                ["snapshot"] = JValue.CreateNull(),
                ["summary"] = new JObject
                {
                    ["requestedCount"] = batchEntries.Count,
                    ["successfulCount"] = successCount,
                    ["failedCount"] = failedCount,
                    ["itemLimit"] = itemLimit
                },
                ["results"] = new JArray(results),
                ["candidates"] = new JArray()
            };
        }

        var resolved = await ResolveStorageTarget(requesterPlayerId, selector);
        var storageService = services.GetRequiredService<IItemStorageService>();
        var storage = await storageService.Get(resolved.StorageRef, (PlayerId)requesterPlayerId);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "describe_storage",
            ["storage"] = BuildResolvedStorageObject(resolved),
            ["snapshot"] = BuildStorageSnapshot(storage, ResolveResolvedStorageCategory(resolved), itemLimit),
            ["summary"] = JValue.CreateNull(),
            ["results"] = new JArray(),
            ["candidates"] = new JArray()
        };
    }

    private static JObject CreateDescribeStorageEntryFailure(int index, string error, JObject? details = null)
    {
        return new JObject
        {
            ["index"] = index,
            ["success"] = false,
            ["error"] = error,
            ["storage"] = JValue.CreateNull(),
            ["snapshot"] = JValue.CreateNull(),
            ["candidates"] = details?["candidates"] is JArray candidates ? new JArray(candidates) : new JArray()
        };
    }

    private async Task<JObject> BuildSpawnOrTakePayload(string commandId, ulong requesterPlayerId, JObject payload, bool isTake)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var itemSelector = ReadProbeArgObject(probeArgs, 1);
        var quantityValue = ReadProbeArgInt64(probeArgs, 2);
        if (!quantityValue.HasValue || quantityValue.Value <= 0)
        {
            return CreateToolboxOpsFailure(commandId, isTake ? "take_item" : "spawn_item", "invalid_quantity");
        }

        var resolved = await ResolveStorageTarget(requesterPlayerId, selector);
        var item = ResolveInventoryItem(itemSelector);
        var rawQuantity = ConvertGameplayQuantityToRaw(item.ItemTypeId, quantityValue.Value);
        if (rawQuantity <= 0)
        {
            return CreateToolboxOpsFailure(commandId, isTake ? "take_item" : "spawn_item", "invalid_quantity");
        }

        var storageService = services.GetRequiredService<IItemStorageService>();
        var operation = new ItemAndQuantity
        {
            item = new ItemInfo
            {
                type = item.ItemTypeId
            },
            quantity = (DeltaQuantity)(isTake ? -rawQuantity : rawQuantity)
        };

        await storageService.GiveOrTakeItem(
            Tag.BotGiveItems((PlayerId)requesterPlayerId),
            resolved.StorageRef,
            operation,
            new OperationOptions());

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = isTake ? "take_item" : "spawn_item",
            ["storage"] = BuildResolvedStorageObject(resolved),
            ["item"] = new JObject
            {
                ["itemTypeId"] = item.ItemTypeId,
                ["itemName"] = item.ItemName,
                ["requestedQuantity"] = quantityValue.Value,
                ["rawQuantity"] = rawQuantity
            },
            ["result"] = new JObject
            {
                ["operation"] = isTake ? "take" : "spawn",
                ["applied"] = true
            }
        };
    }

    private async Task<JObject> BuildSpawnBatchPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var batchEntries = probeArgs is not null && probeArgs.Count > 1 ? probeArgs[1] as JArray : null;
        if (batchEntries is null || batchEntries.Count == 0)
        {
            return CreateToolboxOpsFailure(commandId, "spawn_item_batch", "storage_batch_entries_required");
        }

        var resolved = await ResolveStorageTarget(requesterPlayerId, selector);
        var operations = new List<StorageBatchSpawnEntry>(batchEntries.Count);
        var results = new JObject[batchEntries.Count];

        for (var index = 0; index < batchEntries.Count; index++)
        {
            if (batchEntries[index] is not JObject entry)
            {
                results[index] = CreateStorageBatchEntryFailure(index, "storage_batch_entry_invalid");
                continue;
            }

            var quantityValue = ReadInt64Token(entry["quantity"]);
            if (!quantityValue.HasValue || quantityValue.Value <= 0)
            {
                results[index] = CreateStorageBatchEntryFailure(
                    index,
                    "invalid_quantity",
                    new JObject
                    {
                        ["request"] = entry
                    });
                continue;
            }

            try
            {
                var item = ResolveInventoryItem(entry);
                var rawQuantity = ConvertGameplayQuantityToRaw(item.ItemTypeId, quantityValue.Value);
                if (rawQuantity <= 0)
                {
                    results[index] = CreateStorageBatchEntryFailure(
                        index,
                        "invalid_quantity",
                        new JObject
                        {
                            ["request"] = entry,
                            ["item"] = new JObject
                            {
                                ["itemTypeId"] = item.ItemTypeId,
                                ["itemName"] = item.ItemName,
                                ["requestedQuantity"] = quantityValue.Value,
                                ["rawQuantity"] = rawQuantity
                            }
                        });
                    continue;
                }

                operations.Add(new StorageBatchSpawnEntry
                {
                    Index = index,
                    Request = entry,
                    ItemTypeId = item.ItemTypeId,
                    ItemName = item.ItemName,
                    RequestedQuantity = quantityValue.Value,
                    RawQuantity = rawQuantity,
                    Operation = new ItemAndQuantity
                    {
                        item = new ItemInfo
                        {
                            type = item.ItemTypeId
                        },
                        quantity = (DeltaQuantity)rawQuantity
                    }
                });
            }
            catch (ToolboxOpsException ex)
            {
                var details = ex.Details is null ? new JObject() : new JObject(ex.Details);
                details["request"] = entry;
                results[index] = CreateStorageBatchEntryFailure(index, ex.Message, details);
            }
        }

        if (operations.Count > 0)
        {
            try
            {
                var storageService = services.GetRequiredService<IItemStorageService>();
                await storageService.GiveOrTakeItems(
                    Tag.BotGiveItems((PlayerId)requesterPlayerId),
                    resolved.StorageRef,
                    operations.Select(operation => operation.Operation).ToArray(),
                    new OperationOptions());

                foreach (var operation in operations)
                {
                    results[operation.Index] = new JObject
                    {
                        ["index"] = operation.Index,
                        ["success"] = true,
                        ["error"] = JValue.CreateNull(),
                        ["request"] = operation.Request,
                        ["item"] = new JObject
                        {
                            ["itemTypeId"] = operation.ItemTypeId,
                            ["itemName"] = operation.ItemName,
                            ["requestedQuantity"] = operation.RequestedQuantity,
                            ["rawQuantity"] = operation.RawQuantity
                        },
                        ["result"] = new JObject
                        {
                            ["operation"] = "spawn",
                            ["applied"] = true
                        }
                    };
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "UIToolbox spawn_item_batch failed for storage {StorageLabel}", resolved.Label);
                foreach (var operation in operations)
                {
                    results[operation.Index] = CreateStorageBatchEntryFailure(
                        operation.Index,
                        ex.Message,
                        new JObject
                        {
                            ["request"] = operation.Request,
                            ["item"] = new JObject
                            {
                                ["itemTypeId"] = operation.ItemTypeId,
                                ["itemName"] = operation.ItemName,
                                ["requestedQuantity"] = operation.RequestedQuantity,
                                ["rawQuantity"] = operation.RawQuantity
                            }
                        });
                }
            }
        }

        for (var index = 0; index < results.Length; index++)
        {
            results[index] ??= CreateStorageBatchEntryFailure(index, "storage_batch_entry_unresolved");
        }

        var successCount = results.Count(result => result["success"]?.Value<bool>() == true);
        var failedCount = results.Length - successCount;
        var requestedQuantityTotal = operations.Sum(operation => operation.RequestedQuantity);
        var rawQuantityTotal = operations.Sum(operation => operation.RawQuantity);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = failedCount == 0,
            ["error"] = failedCount == 0 ? JValue.CreateNull() : "storage_batch_contains_failures",
            ["method"] = "spawn_item_batch",
            ["storage"] = BuildResolvedStorageObject(resolved),
            ["summary"] = new JObject
            {
                ["requestedCount"] = batchEntries.Count,
                ["successfulCount"] = successCount,
                ["failedCount"] = failedCount,
                ["requestedQuantityTotal"] = requestedQuantityTotal,
                ["rawQuantityTotal"] = rawQuantityTotal
            },
            ["results"] = new JArray(results)
        };
    }

    private async Task<JObject> BuildMoveSlotPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var fromSelector = ReadProbeArgObject(probeArgs, 0);
        var fromSlot = ReadProbeArgInt32(probeArgs, 1);
        var toSelector = ReadProbeArgObject(probeArgs, 2);
        var quantityValue = ReadProbeArgInt64(probeArgs, 3);
        var toSlot = ReadProbeArgInt32(probeArgs, 4);

        if (!fromSlot.HasValue || fromSlot.Value < 0)
        {
            return CreateToolboxOpsFailure(commandId, "move_slot", "invalid_from_slot");
        }

        if (!quantityValue.HasValue || quantityValue.Value <= 0)
        {
            return CreateToolboxOpsFailure(commandId, "move_slot", "invalid_quantity");
        }

        var fromResolved = await ResolveStorageTarget(requesterPlayerId, fromSelector);
        var toResolved = await ResolveStorageTarget(requesterPlayerId, toSelector);
        var storageService = services.GetRequiredService<IItemStorageService>();
        var fromStorage = await storageService.Get(fromResolved.StorageRef, (PlayerId)requesterPlayerId);
        var fromStorageCategory = ResolveResolvedStorageCategory(fromResolved);
        var sourceSlot = RequireOccupiedSlot(fromStorage, fromSlot.Value, "move_slot");
        var rawQuantity = ConvertGameplayQuantityToRaw(sourceSlot.content.type, quantityValue.Value);
        if (rawQuantity <= 0)
        {
            return CreateToolboxOpsFailure(commandId, "move_slot", "invalid_quantity");
        }

        if (rawQuantity > sourceSlot.quantity.value)
        {
            return CreateToolboxOpsFailure(commandId, "move_slot", "quantity_exceeds_source_slot");
        }

        var destinationStorage = await storageService.Get(toResolved.StorageRef, (PlayerId)requesterPlayerId);
        var effectiveToSlot = toSlot.HasValue && toSlot.Value >= 0
            ? toSlot.Value
            : FindFirstAvailableSlot(destinationStorage);

        await storageService.Move(
            (fromResolved.StorageRef, fromSlot.Value),
            (toResolved.StorageRef, effectiveToSlot),
            (ItemQuantity)rawQuantity,
            (PlayerId)requesterPlayerId);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "move_slot",
            ["from"] = BuildResolvedStorageObject(fromResolved),
            ["to"] = BuildResolvedStorageObject(toResolved),
            ["sourceSlot"] = BuildStorageSlotObject(sourceSlot),
            ["requestedQuantity"] = quantityValue.Value,
            ["rawQuantity"] = rawQuantity,
            ["appliedToSlot"] = effectiveToSlot,
            ["sourceCategory"] = fromStorageCategory
        };
    }

    private async Task<JObject> BuildDropSlotPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var slot = ReadProbeArgInt32(probeArgs, 1);
        var quantityValue = ReadProbeArgInt64(probeArgs, 2);

        if (!slot.HasValue || slot.Value < 0)
        {
            return CreateToolboxOpsFailure(commandId, "drop_slot", "invalid_slot");
        }

        if (!quantityValue.HasValue || quantityValue.Value <= 0)
        {
            return CreateToolboxOpsFailure(commandId, "drop_slot", "invalid_quantity");
        }

        var resolved = await ResolveStorageTarget(requesterPlayerId, selector);
        var storageService = services.GetRequiredService<IItemStorageService>();
        var storage = await storageService.Get(resolved.StorageRef, (PlayerId)requesterPlayerId);
        var sourceSlot = RequireOccupiedSlot(storage, slot.Value, "drop_slot");
        var rawQuantity = ConvertGameplayQuantityToRaw(sourceSlot.content.type, quantityValue.Value);
        if (rawQuantity <= 0)
        {
            return CreateToolboxOpsFailure(commandId, "drop_slot", "invalid_quantity");
        }

        if (rawQuantity > sourceSlot.quantity.value)
        {
            return CreateToolboxOpsFailure(commandId, "drop_slot", "quantity_exceeds_source_slot");
        }

        await storageService.Perform(
            Tag.InventoryMove((PlayerId)requesterPlayerId),
            async tr =>
            {
                await storageService.Drop(
                    tr,
                    resolved.StorageRef,
                    slot.Value,
                    (PlayerId)requesterPlayerId,
                    (ItemQuantity)rawQuantity,
                    false);
            });

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "drop_slot",
            ["storage"] = BuildResolvedStorageObject(resolved),
            ["slot"] = BuildStorageSlotObject(sourceSlot),
            ["requestedQuantity"] = quantityValue.Value,
            ["rawQuantity"] = rawQuantity
        };
    }

    private async Task<JObject> BuildRenameElementBatchPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var probeArgs = payload["probeArgs"] as JArray;
        var batchOptions = ReadProbeArgObject(probeArgs, 0) ?? new JObject();
        var batchEntries = probeArgs is not null && probeArgs.Count > 1 ? probeArgs[1] as JArray : null;
        if (batchEntries is null || batchEntries.Count == 0)
        {
            return CreateToolboxOpsFailure(commandId, "rename_element_batch", "rename_batch_entries_required");
        }

        var constructIdValue = ReadUInt64Token(batchOptions["constructId"]);
        var results = new JArray();

        for (var index = 0; index < batchEntries.Count; index++)
        {
            if (batchEntries[index] is not JObject entry)
            {
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = "rename_batch_entry_invalid"
                });
                continue;
            }

            var newName = (entry["newName"]?.Value<string>() ?? "").Trim();
            if (string.IsNullOrWhiteSpace(newName))
            {
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = "invalid_element_name"
                });
                continue;
            }

            var entrySelector = new JObject();
            if (constructIdValue.HasValue && constructIdValue.Value > 0)
            {
                entrySelector["constructId"] = constructIdValue.Value;
            }

            var localId = ReadUInt64Token(entry["localId"]);
            var name = entry["name"]?.Value<string>()?.Trim();
            if (localId.HasValue && localId.Value > 0)
            {
                entrySelector["localId"] = localId.Value;
            }
            else if (!string.IsNullOrWhiteSpace(name))
            {
                entrySelector["name"] = name;
            }
            else
            {
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = "rename_selector_requires_exactly_one_of_localId_name"
                });
                continue;
            }

            try
            {
                var target = await ResolveConstructElementTarget(requesterPlayerId, entrySelector);
                var beforeName = TryReadElementCustomName(target.Element);
                var update = new ElementPropertyUpdate
                {
                    name = "name",
                    value = new PropertyValue(newName),
                    elementId = target.Element.elementId,
                    constructId = target.Element.constructId,
                    timePoint = TimePoint.Now(),
                    relative = false
                };

                await orleans.GetElementManagementGrain().ElementPropertyUpdate((PlayerId)requesterPlayerId, update);

                var updatedTarget = await ResolveConstructElementTarget(
                    requesterPlayerId,
                    new JObject
                    {
                        ["constructId"] = target.Element.constructId,
                        ["elementId"] = target.Element.elementId
                    });

                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = true,
                    ["target"] = BuildResolvedConstructElementObject(updatedTarget),
                    ["result"] = new JObject
                    {
                        ["operation"] = "rename_element",
                        ["applied"] = true,
                        ["propertyName"] = "name",
                        ["beforeName"] = string.IsNullOrWhiteSpace(beforeName) ? JValue.CreateNull() : beforeName,
                        ["afterName"] = newName
                    }
                });
            }
            catch (ToolboxOpsException ex)
            {
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = ex.Message,
                    ["details"] = ex.Details is null ? JValue.CreateNull() : ex.Details
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "UIToolbox rename batch failed at index {Index}", index);
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = ex.Message
                });
            }
        }

        var successfulCount = results.Count(result => result?["success"]?.Value<bool>() == true);
        var failedCount = results.Count - successfulCount;
        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = failedCount == 0,
            ["error"] = failedCount == 0 ? JValue.CreateNull() : "rename_batch_contains_failures",
            ["method"] = "rename_element_batch",
            ["summary"] = new JObject
            {
                ["requestedCount"] = results.Count,
                ["successfulCount"] = successfulCount,
                ["failedCount"] = failedCount
            },
            ["results"] = results
        };
    }

    private async Task<JObject> BuildElementAddPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var request = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var fromSlot = ReadInt32Token(request["fromSlot"]);
        if (!fromSlot.HasValue || fromSlot.Value < 0)
        {
            return CreateToolboxOpsFailure(commandId, "element_add", "invalid_from_slot");
        }

        var requestedConstructId = ReadUInt64Token(request["constructId"]);
        var constructId = requestedConstructId.HasValue && requestedConstructId.Value > 0
            ? (ConstructId)requestedConstructId.Value
            : (await ResolveConstructIdForInspection(requesterPlayerId, null, 0)).ConstructId;
        var location = BuildRelativeLocation(request, constructId);
        if (location is null)
        {
            return CreateToolboxOpsFailure(commandId, "element_add", "invalid_location");
        }

        var sourceSlot = await ResolveElementDeploySourceSlot(requesterPlayerId, fromSlot.Value);
        var itemName = ResolveItemTypeName(0, sourceSlot.content.type);
        var deploy = new ElementDeploy
        {
            element = new ElementInfo
            {
                constructId = (ulong)constructId,
                elementType = sourceSlot.content.type,
                position = location.position,
                rotation = location.rotation,
                properties = new Dictionary<string, PropertyValue>()
            },
            fromInventory = new ItemId
            {
                typeId = sourceSlot.content.type,
                instanceId = sourceSlot.content.id,
                ownerId = sourceSlot.content.owner
            }
        };

        var added = await orleans.GetElementManagementGrain().ElementAdd((PlayerId)requesterPlayerId, deploy);
        var resolvedTarget = await ResolveConstructElementTarget(
            requesterPlayerId,
            new JObject
            {
                ["constructId"] = added.constructId,
                ["elementId"] = added.elementId
            });

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "element_add",
            ["target"] = BuildResolvedConstructElementObject(resolvedTarget),
            ["sourceSlot"] = BuildStorageSlotObject(sourceSlot),
            ["result"] = new JObject
            {
                ["operation"] = "add_element",
                ["status"] = "applied",
                ["itemTypeId"] = sourceSlot.content.type,
                ["itemName"] = itemName,
                ["fromSlot"] = fromSlot.Value
            }
        };
    }

    private async Task<JObject> BuildElementDeleteOrDestroyPayload(string commandId, ulong requesterPlayerId, JObject payload, bool destroy)
    {
        var request = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var target = await ResolveConstructElementTarget(requesterPlayerId, request);
        var targetRef = ElementInConstruct.Mk((ConstructId)target.Element.constructId, (ElementId)target.Element.elementId);
        var elementManagement = orleans.GetElementManagementGrain();
        var returned = destroy
            ? await elementManagement.ElementDestroy((PlayerId)requesterPlayerId, targetRef)
            : await elementManagement.ElementDelete((PlayerId)requesterPlayerId, targetRef);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = destroy ? "element_destroy" : "element_delete",
            ["target"] = new JObject
            {
                ["label"] = target.Label,
                ["construct"] = BuildConstructDescriptor(target.ConstructContext),
                ["element"] = BuildElementSummary(target.ConstructContext, returned)
            },
            ["result"] = new JObject
            {
                ["operation"] = destroy ? "destroy_element" : "delete_element",
                ["status"] = "applied",
                ["returnedToInventory"] = !destroy
            }
        };
    }

    private async Task<JObject> BuildElementReplacePayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var request = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var target = await ResolveConstructElementTarget(requesterPlayerId, request);

        await orleans.GetElementManagementGrain().ReplaceElement(
            (PlayerId)requesterPlayerId,
            ElementInConstruct.Mk((ConstructId)target.Element.constructId, (ElementId)target.Element.elementId));

        var updatedTarget = await ResolveConstructElementTarget(
            requesterPlayerId,
            new JObject
            {
                ["constructId"] = target.Element.constructId,
                ["elementId"] = target.Element.elementId
            });

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "element_replace",
            ["target"] = BuildResolvedConstructElementObject(updatedTarget),
            ["result"] = new JObject
            {
                ["operation"] = "replace_element",
                ["status"] = "applied"
            }
        };
    }

    private async Task<JObject> BuildElementLinkPayload(string commandId, ulong requesterPlayerId, JObject payload, bool create)
    {
        var request = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var fromPlug = ReadInt32Token(request["fromPlug"]);
        var toPlug = ReadInt32Token(request["toPlug"]);
        var plugType = ReadPlugTypeToken(request["plugType"]);
        if (!fromPlug.HasValue)
        {
            return CreateToolboxOpsFailure(commandId, create ? "element_link_create" : "element_link_delete", "invalid_from_plug");
        }

        if (!toPlug.HasValue)
        {
            return CreateToolboxOpsFailure(commandId, create ? "element_link_create" : "element_link_delete", "invalid_to_plug");
        }

        if (!plugType.HasValue || plugType.Value == PlugType.PLUG_INVALID || plugType.Value == PlugType.PLUG_END)
        {
            return CreateToolboxOpsFailure(commandId, create ? "element_link_create" : "element_link_delete", "invalid_plug_type");
        }

        var constructIdValue = ReadUInt64Token(request["constructId"]);
        var fromTarget = await ResolveConstructElementTarget(requesterPlayerId, MergeSelectorWithConstructId(request["from"] as JObject, constructIdValue));
        var toTarget = await ResolveConstructElementTarget(requesterPlayerId, MergeSelectorWithConstructId(request["to"] as JObject, constructIdValue));
        if (fromTarget.Element.constructId != toTarget.Element.constructId)
        {
            return CreateToolboxOpsFailure(commandId, create ? "element_link_create" : "element_link_delete", "link_endpoints_must_share_construct");
        }

        var link = new LinkInfo
        {
            constructId = fromTarget.Element.constructId,
            fromElementId = fromTarget.Element.elementId,
            fromPlug = fromPlug.Value,
            toElementId = toTarget.Element.elementId,
            toPlug = toPlug.Value,
            plugType = plugType.Value
        };

        var elementManagement = orleans.GetElementManagementGrain();
        if (create)
        {
            await elementManagement.ElementLinkCreate((PlayerId)requesterPlayerId, link);
        }
        else
        {
            await elementManagement.ElementLinkDelete((PlayerId)requesterPlayerId, link);
        }

        var refreshedFrom = await ResolveConstructElementTarget(
            requesterPlayerId,
            new JObject
            {
                ["constructId"] = fromTarget.Element.constructId,
                ["elementId"] = fromTarget.Element.elementId
            });
        var refreshedTo = await ResolveConstructElementTarget(
            requesterPlayerId,
            new JObject
            {
                ["constructId"] = toTarget.Element.constructId,
                ["elementId"] = toTarget.Element.elementId
            });

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = create ? "element_link_create" : "element_link_delete",
            ["link"] = BuildResolvedElementLinkObject(refreshedFrom.ConstructContext, link, refreshedFrom.Element, refreshedTo.Element),
            ["result"] = new JObject
            {
                ["operation"] = create ? "create_element_link" : "delete_element_link",
                ["status"] = "applied"
            }
        };
    }

    private async Task<JObject> BuildConstructRuntimeAvailabilityPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var selector = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var playerPosition = await orleans.GetPlayerGrain((PlayerId)requesterPlayerId).GetPositionUpdate();
        var currentConstructId = playerPosition?.localPosition?.constructId ?? 0UL;
        var targetConstructId = requestedConstructId.HasValue && requestedConstructId.Value > 0
            ? requestedConstructId.Value
            : currentConstructId;
        var currentConstructData = currentConstructId > 0
            ? await TryReadTargetingConstructData((ConstructId)currentConstructId)
            : null;
        var targetConstructData = targetConstructId > 0
            ? (currentConstructId == targetConstructId
                ? currentConstructData
                : await TryReadTargetingConstructData((ConstructId)targetConstructId))
            : null;
        var liveReadsExpected = currentConstructId > 0
            && targetConstructId > 0
            && currentConstructId == targetConstructId;

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "construct_runtime_availability",
            ["currentConstruct"] = new JObject
            {
                ["constructId"] = currentConstructId == 0 ? JValue.CreateNull() : new JValue(currentConstructId),
                ["constructName"] = string.IsNullOrWhiteSpace(currentConstructData?.constructName) ? JValue.CreateNull() : currentConstructData!.constructName
            },
            ["targetConstruct"] = new JObject
            {
                ["constructId"] = targetConstructId == 0 ? JValue.CreateNull() : new JValue(targetConstructId),
                ["constructName"] = string.IsNullOrWhiteSpace(targetConstructData?.constructName) ? JValue.CreateNull() : targetConstructData!.constructName,
                ["usedCurrentConstruct"] = !requestedConstructId.HasValue || requestedConstructId.Value == 0
            },
            ["availability"] = new JObject
            {
                ["playerInConstruct"] = currentConstructId > 0,
                ["liveIndustryReadsExpected"] = liveReadsExpected,
                ["liveStorageReadsExpected"] = liveReadsExpected,
                ["reason"] = liveReadsExpected
                    ? "player_at_target_construct"
                    : currentConstructId == 0
                        ? "player_not_in_construct"
                        : targetConstructId == 0
                            ? "target_construct_unresolved"
                            : "player_not_at_target_construct"
            }
        };
    }

    private async Task<JObject> BuildPlayerPositionPayload(string commandId, ulong requesterPlayerId)
    {
        var playerPosition = await orleans.GetPlayerGrain((PlayerId)requesterPlayerId).GetPositionUpdate();
        var localPosition = playerPosition?.localPosition;
        var currentConstructId = localPosition?.constructId ?? 0UL;
        var currentConstructData = currentConstructId > 0
            ? await TryReadTargetingConstructData((ConstructId)currentConstructId)
            : null;

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = playerPosition is not null,
            ["error"] = playerPosition is null ? "player_position_unavailable" : JValue.CreateNull(),
            ["method"] = "player_position",
            ["playerId"] = requesterPlayerId,
            ["construct"] = new JObject
            {
                ["constructId"] = currentConstructId == 0 ? JValue.CreateNull() : new JValue(currentConstructId),
                ["constructName"] = string.IsNullOrWhiteSpace(currentConstructData?.constructName) ? JValue.CreateNull() : currentConstructData!.constructName
            },
            ["localPosition"] = localPosition is null
                ? JValue.CreateNull()
                : new JObject
                {
                    ["constructId"] = localPosition.constructId,
                    ["position"] = BuildVec3Object(localPosition.position),
                    ["rotation"] = BuildQuatObject(localPosition.rotation)
                },
            ["universePosition"] = playerPosition is null ? JValue.CreateNull() : BuildVec3Object(playerPosition.universePosition)
        };
    }

    private async Task<JObject> BuildResolveIndustryRecipePayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        await WarnIfRequesterHasDevCraftingSpeedTalentOnce(requesterPlayerId, "resolve_industry_recipe");

        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var recipeSelector = ReadProbeArgObject(probeArgs, 1);
        var target = await ResolveIndustryTarget(requesterPlayerId, selector);
        var resolvedRecipe = await ResolveIndustryRecipeTarget(target, recipeSelector);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "resolve_industry_recipe",
            ["target"] = BuildResolvedIndustryObject(target),
            ["recipe"] = BuildResolvedIndustryRecipeObject(resolvedRecipe)
        };
    }

    private async Task<JObject> BuildDescribeIndustryBatchPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        await WarnIfRequesterHasDevCraftingSpeedTalentOnce(requesterPlayerId, "describe_industry_batch");

        var probeArgs = payload["probeArgs"] as JArray;
        var batchOptions = ReadProbeArgObject(probeArgs, 0) ?? new JObject();
        var batchEntries = probeArgs is not null && probeArgs.Count > 1 ? probeArgs[1] as JArray : null;
        if (batchEntries is null || batchEntries.Count == 0)
        {
            return CreateToolboxOpsFailure(commandId, "describe_industry_batch", "industry_batch_entries_required");
        }

        var constructIdValue = ReadUInt64Token(batchOptions["constructId"]);
        var results = new JArray();

        for (var index = 0; index < batchEntries.Count; index++)
        {
            if (batchEntries[index] is not JObject entry)
            {
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = "industry_batch_entry_invalid"
                });
                continue;
            }

            try
            {
                var targetSelector = new JObject();
                if (constructIdValue.HasValue && constructIdValue.Value > 0)
                {
                    targetSelector["constructId"] = constructIdValue.Value;
                }

                var localId = ReadUInt64Token(entry["localId"]);
                var name = entry["name"]?.Value<string>()?.Trim();
                if (localId.HasValue && localId.Value > 0)
                {
                    targetSelector["localId"] = localId.Value;
                }
                else if (!string.IsNullOrWhiteSpace(name))
                {
                    targetSelector["name"] = name;
                }
                else
                {
                    throw new ToolboxOpsException("industry_selector_requires_exactly_one_of_localId_name");
                }

                var target = await ResolveIndustryTarget(requesterPlayerId, targetSelector);
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = true,
                    ["target"] = BuildResolvedIndustryObject(target),
                    ["state"] = await TryBuildIndustryRuntimePayload(target.Element)
                });
            }
            catch (ToolboxOpsException ex)
            {
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = ex.Message,
                    ["details"] = ex.Details is null ? JValue.CreateNull() : ex.Details
                });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "UIToolbox industry batch describe failed at index {Index}", index);
                results.Add(new JObject
                {
                    ["index"] = index,
                    ["success"] = false,
                    ["error"] = ex.Message
                });
            }
        }

        var successfulCount = results.Count(result => result?["success"]?.Value<bool>() == true);
        var failedCount = results.Count - successfulCount;
        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = failedCount == 0,
            ["error"] = failedCount == 0 ? JValue.CreateNull() : "industry_batch_contains_failures",
            ["method"] = "describe_industry_batch",
            ["summary"] = new JObject
            {
                ["requestedCount"] = results.Count,
                ["successfulCount"] = successfulCount,
                ["failedCount"] = failedCount
            },
            ["results"] = results
        };
    }

    private async Task<JObject> BuildIndustryStopPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        await WarnIfRequesterHasDevCraftingSpeedTalentOnce(requesterPlayerId, "industry_stop");

        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var stopMode = (ReadProbeArgString(probeArgs, 1) ?? "soft").Trim().ToLowerInvariant();
        if (stopMode != "soft" && stopMode != "hard")
        {
            return CreateToolboxOpsFailure(commandId, "industry_stop", "invalid_stop_mode");
        }

        var target = await ResolveIndustryTarget(requesterPlayerId, selector);
        var grain = orleans.GetIndustryUnitGrain(target.Element.elementId);
        if (stopMode == "soft")
        {
            await grain.StopSoft();
        }
        else
        {
            await grain.StopHard(true);
        }

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "industry_stop",
            ["target"] = BuildResolvedIndustryObject(target),
            ["result"] = new JObject
            {
                ["operation"] = "stop",
                ["stopMode"] = stopMode,
                ["applied"] = true
            },
            ["state"] = await TryBuildIndustryRuntimePayload(target.Element)
        };
    }

    private async Task<JObject> BuildIndustrySetRecipePayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        await WarnIfRequesterHasDevCraftingSpeedTalentOnce(requesterPlayerId, "industry_set_recipe");

        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var recipeSelector = ReadProbeArgObject(probeArgs, 1);
        var target = await ResolveIndustryTarget(requesterPlayerId, selector);
        var grain = orleans.GetIndustryUnitGrain(target.Element.elementId);
        var status = await grain.Status();
        if (status.state != IndustryState.STOPPED)
        {
            return CreateToolboxOpsFailure(
                commandId,
                "industry_set_recipe",
                "industry_not_stopped",
                new JObject
                {
                    ["target"] = BuildResolvedIndustryObject(target),
                    ["state"] = await TryBuildIndustryRuntimePayload(target.Element)
                });
        }

        var resolvedRecipe = await ResolveIndustryRecipeTarget(target, recipeSelector);
        await grain.SetRecipe(resolvedRecipe.RecipeId, requesterPlayerId);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "industry_set_recipe",
            ["target"] = BuildResolvedIndustryObject(target),
            ["recipe"] = BuildResolvedIndustryRecipeObject(resolvedRecipe),
            ["result"] = new JObject
            {
                ["operation"] = "set_recipe",
                ["applied"] = true
            },
            ["state"] = await TryBuildIndustryRuntimePayload(target.Element)
        };
    }

    private async Task<JObject> BuildIndustryStartPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        await WarnIfRequesterHasDevCraftingSpeedTalentOnce(requesterPlayerId, "industry_start");

        var probeArgs = payload["probeArgs"] as JArray;
        var selector = ReadProbeArgObject(probeArgs, 0);
        var startMode = (ReadProbeArgString(probeArgs, 1) ?? "").Trim().ToLowerInvariant();
        var requestedAmount = ReadProbeArgInt64(probeArgs, 2);
        if (startMode != "run" && startMode != "make" && startMode != "move" && startMode != "maintain")
        {
            return CreateToolboxOpsFailure(commandId, "industry_start", "invalid_start_mode");
        }

        var target = await ResolveIndustryTarget(requesterPlayerId, selector);
        var grain = orleans.GetIndustryUnitGrain(target.Element.elementId);
        var start = new IndustryStart
        {
            elementId = target.Element.elementId,
            numBatches = 0,
            maintainProductAmount = 0
        };

        if (startMode == "make" || startMode == "move")
        {
            if (!requestedAmount.HasValue || requestedAmount.Value <= 0)
            {
                return CreateToolboxOpsFailure(commandId, "industry_start", "invalid_start_amount");
            }

            start.numBatches = (ulong)requestedAmount.Value;
        }
        else if (startMode == "maintain")
        {
            if (!requestedAmount.HasValue || requestedAmount.Value < 0)
            {
                return CreateToolboxOpsFailure(commandId, "industry_start", "invalid_start_amount");
            }

            var activeRecipe = await grain.Recipe();
            if (activeRecipe is null || activeRecipe.products is null || activeRecipe.products.Count == 0)
            {
                return CreateToolboxOpsFailure(commandId, "industry_start", "industry_recipe_required_for_maintain");
            }

            var productTypeId = activeRecipe.products[0].itemId;
            start.maintainProductAmount = (ulong)ConvertGameplayQuantityToRaw(productTypeId, requestedAmount.Value);
        }

        await grain.Start(requesterPlayerId, start);

        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = true,
            ["error"] = JValue.CreateNull(),
            ["method"] = "industry_start",
            ["target"] = BuildResolvedIndustryObject(target),
            ["start"] = new JObject
            {
                ["mode"] = startMode,
                ["requestedAmount"] = requestedAmount.HasValue ? new JValue(requestedAmount.Value) : JValue.CreateNull(),
                ["numBatches"] = (long)start.numBatches,
                ["maintainRawAmount"] = (long)start.maintainProductAmount
            },
            ["result"] = new JObject
            {
                ["operation"] = "start",
                ["applied"] = true
            },
            ["state"] = await TryBuildIndustryRuntimePayload(target.Element)
        };
    }

    private async Task<JObject> BuildIndustryConfigureBatchPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        await WarnIfRequesterHasDevCraftingSpeedTalentOnce(requesterPlayerId, "industry_configure_batch");

        var probeArgs = payload["probeArgs"] as JArray;
        var batchOptions = ReadProbeArgObject(probeArgs, 0) ?? new JObject();
        var batchEntries = probeArgs is not null && probeArgs.Count > 1 ? probeArgs[1] as JArray : null;
        if (batchEntries is null || batchEntries.Count == 0)
        {
            return CreateToolboxOpsFailure(commandId, "industry_configure_batch", "industry_batch_entries_required");
        }

        var constructIdValue = ReadUInt64Token(batchOptions["constructId"]);
        var stopMode = (batchOptions["stopMode"]?.Value<string>()?.Trim() ?? "soft").ToLowerInvariant();
        if (stopMode != "soft" && stopMode != "hard")
        {
            return CreateToolboxOpsFailure(commandId, "industry_configure_batch", "invalid_stop_mode");
        }

        var parallelism = ClampInt32(ReadInt32Token(batchOptions["parallelism"]), 1, 10, 1);
        var pollIntervalMs = ClampInt32(ReadInt32Token(batchOptions["pollIntervalMs"]), 50, 1000, 150);
        var stateTimeoutMs = ClampInt32(ReadInt32Token(batchOptions["stateTimeoutMs"]), 500, 30000, 5000);

        var operations = new List<IndustryBatchOperation>(batchEntries.Count);
        for (var index = 0; index < batchEntries.Count; index++)
        {
            if (batchEntries[index] is not JObject entry)
            {
                throw new ToolboxOpsException(
                    "industry_batch_entry_invalid",
                    new JObject
                    {
                        ["index"] = index
                    });
            }

            var localId = ReadUInt64Token(entry["localId"]);
            if (!localId.HasValue || localId.Value == 0)
            {
                throw new ToolboxOpsException(
                    "industry_batch_localId_required",
                    new JObject
                    {
                        ["index"] = index
                    });
            }

            var startMode = (entry["mode"]?.Value<string>()?.Trim() ?? "").ToLowerInvariant();
            if (startMode != "run" && startMode != "make" && startMode != "move" && startMode != "maintain")
            {
                throw new ToolboxOpsException(
                    "industry_batch_invalid_start_mode",
                    new JObject
                    {
                        ["index"] = index,
                        ["localId"] = localId.Value,
                        ["mode"] = string.IsNullOrWhiteSpace(startMode) ? JValue.CreateNull() : startMode
                    });
            }

            var requestedAmount = ReadInt64Token(entry["amount"]);
            var targetSelector = new JObject
            {
                ["localId"] = localId.Value
            };
            if (constructIdValue.HasValue && constructIdValue.Value > 0)
            {
                targetSelector["constructId"] = constructIdValue.Value;
            }

            var recipeSelector = BuildBatchIndustryRecipeSelector(entry);
            var target = await ResolveIndustryTarget(requesterPlayerId, targetSelector);
            var recipe = await ResolveIndustryRecipeTarget(target, recipeSelector);
            operations.Add(new IndustryBatchOperation
            {
                Index = index,
                Request = entry,
                Target = target,
                Recipe = recipe,
                StartMode = startMode,
                RequestedAmount = requestedAmount
            });
        }

        var distinctElementTypes = operations
            .Select(operation => operation.Target.Element.elementType)
            .Distinct()
            .ToList();
        if (distinctElementTypes.Count > 1)
        {
            return CreateToolboxOpsFailure(
                commandId,
                "industry_configure_batch",
                "industry_batch_requires_same_element_type",
                new JObject
                {
                    ["candidates"] = new JArray(operations.Select(operation => new JObject
                    {
                        ["index"] = operation.Index,
                        ["localId"] = operation.Target.Element.localId,
                        ["label"] = operation.Target.Label,
                        ["elementTypeId"] = operation.Target.Element.elementType,
                        ["typeName"] = ResolveElementTypeName(operation.Target.ConstructContext, operation.Target.Element)
                    }))
                });
        }

        var results = new JObject[operations.Count];
        using (var gate = new SemaphoreSlim(parallelism, parallelism))
        {
            var tasks = operations.Select(async operation =>
            {
                await gate.WaitAsync();
                try
                {
                    results[operation.Index] = await ExecuteIndustryBatchOperation(
                        requesterPlayerId,
                        operation,
                        stopMode,
                        pollIntervalMs,
                        stateTimeoutMs);
                }
                finally
                {
                    gate.Release();
                }
            }).ToList();

            await Task.WhenAll(tasks);
        }

        var successful = results.All(result => result["success"]?.Value<bool>() == true);
        return new JObject
        {
            ["commandId"] = commandId,
            ["success"] = successful,
            ["error"] = successful ? JValue.CreateNull() : "industry_batch_contains_failures",
            ["method"] = "industry_configure_batch",
            ["summary"] = new JObject
            {
                ["requestedCount"] = operations.Count,
                ["successfulCount"] = results.Count(result => result["success"]?.Value<bool>() == true),
                ["failedCount"] = results.Count(result => result["success"]?.Value<bool>() != true),
                ["parallelism"] = parallelism,
                ["stopMode"] = stopMode,
                ["pollIntervalMs"] = pollIntervalMs,
                ["stateTimeoutMs"] = stateTimeoutMs,
                ["elementTypeId"] = distinctElementTypes[0],
                ["industryKind"] = operations[0].Target.IndustryKind
            },
            ["results"] = new JArray(results)
        };
    }

    private async Task<JObject> ExecuteIndustryBatchOperation(
        ulong requesterPlayerId,
        IndustryBatchOperation operation,
        string stopMode,
        int pollIntervalMs,
        int stateTimeoutMs)
    {
        try
        {
            var grain = orleans.GetIndustryUnitGrain(operation.Target.Element.elementId);
            var desiredRecipeId = operation.Recipe.RecipeId;
            var beforeState = await ReadIndustryRuntimePayload(operation.Target.Element.elementId);
            var currentState = beforeState;
            var stopApplied = false;
            var recipeSetApplied = false;
            var startApplied = false;
            JObject? afterStopState = null;
            JObject? afterSetState = null;

            if (IndustryRuntimeAlreadyMatches(currentState, desiredRecipeId, operation.StartMode, operation.RequestedAmount, operation.Recipe.ProductItemTypeId))
            {
                return new JObject
                {
                    ["index"] = operation.Index,
                    ["success"] = true,
                    ["target"] = BuildResolvedIndustryObject(operation.Target),
                    ["recipe"] = BuildResolvedIndustryRecipeObject(operation.Recipe),
                    ["start"] = BuildIndustryStartDescriptor(operation.Recipe, operation.StartMode, operation.RequestedAmount),
                    ["beforeState"] = beforeState,
                    ["state"] = beforeState,
                    ["result"] = new JObject
                    {
                        ["operation"] = "configure",
                        ["stopApplied"] = false,
                        ["recipeSetApplied"] = false,
                        ["activationApplied"] = false,
                        ["startApplied"] = false,
                        ["alreadyConfigured"] = true
                    }
                };
            }

            var needsRecipeChange = IndustryRuntimeRecipeId(currentState) != desiredRecipeId
                || IndustryRuntimeNextRecipeId(currentState) != desiredRecipeId;
            if (needsRecipeChange && !IndustryRuntimeIsStopped(currentState))
            {
                if (stopMode == "soft")
                {
                    await grain.StopSoft();
                }
                else
                {
                    await grain.StopHard(true);
                }

                stopApplied = true;
                currentState = await WaitForIndustryRuntimeCondition(
                    operation.Target.Element.elementId,
                    pollIntervalMs,
                    stateTimeoutMs,
                    runtime => IndustryRuntimeIsStopped(runtime),
                    "industry_stop_timeout");
                afterStopState = currentState;
            }

            if (needsRecipeChange)
            {
                if (!IndustryRuntimeIsStopped(currentState))
                {
                    throw new ToolboxOpsException("industry_not_stopped");
                }

                await grain.SetRecipe(desiredRecipeId, requesterPlayerId);
                recipeSetApplied = true;
                currentState = await WaitForIndustryRuntimeCondition(
                    operation.Target.Element.elementId,
                    pollIntervalMs,
                    stateTimeoutMs,
                    runtime => IndustryRuntimeRecipeId(runtime) == desiredRecipeId || IndustryRuntimeNextRecipeId(runtime) == desiredRecipeId,
                    "industry_set_recipe_timeout");
                afterSetState = currentState;
            }
            var desiredStart = await BuildIndustryStartRequest(operation.Target, operation.StartMode, operation.RequestedAmount, operation.Recipe.ProductItemTypeId);
            await grain.Start(requesterPlayerId, desiredStart);
            startApplied = true;
            currentState = await WaitForIndustryRuntimeCondition(
                operation.Target.Element.elementId,
                pollIntervalMs,
                stateTimeoutMs,
                runtime => IndustryRuntimeMatchesStart(runtime, desiredRecipeId, operation.StartMode, operation.RequestedAmount, operation.Recipe.ProductItemTypeId),
                "industry_start_timeout");

            return new JObject
            {
                ["index"] = operation.Index,
                ["success"] = true,
                ["target"] = BuildResolvedIndustryObject(operation.Target),
                ["recipe"] = BuildResolvedIndustryRecipeObject(operation.Recipe),
                ["start"] = BuildIndustryStartDescriptor(operation.Recipe, operation.StartMode, operation.RequestedAmount),
                ["beforeState"] = beforeState,
                ["afterStopState"] = afterStopState is null ? JValue.CreateNull() : afterStopState,
                ["afterSetState"] = afterSetState is null ? JValue.CreateNull() : afterSetState,
                ["afterActivationState"] = JValue.CreateNull(),
                ["state"] = currentState,
                ["result"] = new JObject
                {
                    ["operation"] = "configure",
                    ["stopApplied"] = stopApplied,
                    ["recipeSetApplied"] = recipeSetApplied,
                    ["activationApplied"] = false,
                    ["startApplied"] = startApplied,
                    ["alreadyConfigured"] = false
                }
            };
        }
        catch (ToolboxOpsException ex)
        {
            return CreateIndustryBatchOperationFailure(operation, ex.Message, ex.Details);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "UIToolbox industry batch configure failed for localId {LocalId}", operation.Target.Element.localId);
            return CreateIndustryBatchOperationFailure(operation, ex.Message);
        }
    }

    private async Task<JObject> ReadIndustryRuntimePayload(ulong elementId)
    {
        var status = await orleans.GetIndustryUnitGrain(elementId).Status();
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

    private async Task<JObject> WaitForIndustryRuntimeCondition(
        ulong elementId,
        int pollIntervalMs,
        int timeoutMs,
        Func<JObject, bool> predicate,
        string timeoutError)
    {
        var startedAt = DateTime.UtcNow;
        JObject? lastState = null;
        while ((DateTime.UtcNow - startedAt).TotalMilliseconds <= timeoutMs)
        {
            lastState = await ReadIndustryRuntimePayload(elementId);
            if (predicate(lastState))
            {
                return lastState;
            }

            await Task.Delay(pollIntervalMs);
        }

        throw new ToolboxOpsException(
            timeoutError,
            lastState is null
                ? null
                : new JObject
                {
                    ["state"] = lastState
                });
    }

    private async Task<IndustryStart> BuildIndustryStartRequest(
        ResolvedToolboxIndustryTarget target,
        string startMode,
        long? requestedAmount,
        ulong? maintainProductItemTypeId = null)
    {
        var start = new IndustryStart
        {
            elementId = target.Element.elementId,
            numBatches = 0,
            maintainProductAmount = 0
        };

        if (startMode == "make" || startMode == "move")
        {
            if (!requestedAmount.HasValue || requestedAmount.Value <= 0)
            {
                throw new ToolboxOpsException("invalid_start_amount");
            }

            start.numBatches = (ulong)requestedAmount.Value;
            return start;
        }

        if (startMode == "maintain")
        {
            if (!requestedAmount.HasValue || requestedAmount.Value < 0)
            {
                throw new ToolboxOpsException("invalid_start_amount");
            }

            var productTypeId = maintainProductItemTypeId.GetValueOrDefault();
            if (productTypeId == 0)
            {
                var activeRecipe = await orleans.GetIndustryUnitGrain(target.Element.elementId).Recipe();
                if (activeRecipe is null || activeRecipe.products is null || activeRecipe.products.Count == 0)
                {
                    throw new ToolboxOpsException("industry_recipe_required_for_maintain");
                }

                productTypeId = activeRecipe.products[0].itemId;
            }

            start.maintainProductAmount = (ulong)ConvertGameplayQuantityToRaw(productTypeId, requestedAmount.Value);
            return start;
        }

        return start;
    }

    private JObject BuildIndustryStartDescriptor(ResolvedToolboxIndustryRecipe recipe, string startMode, long? requestedAmount)
    {
        var descriptor = new JObject
        {
            ["mode"] = startMode,
            ["requestedAmount"] = requestedAmount.HasValue ? new JValue(requestedAmount.Value) : JValue.CreateNull()
        };

        if (startMode == "maintain" && requestedAmount.HasValue && requestedAmount.Value >= 0)
        {
            descriptor["maintainRawAmount"] = ConvertGameplayQuantityToRaw(recipe.ProductItemTypeId, requestedAmount.Value);
        }
        else
        {
            descriptor["maintainRawAmount"] = 0;
        }

        descriptor["numBatches"] = (startMode == "make" || startMode == "move") && requestedAmount.HasValue && requestedAmount.Value > 0
            ? requestedAmount.Value
            : 0;
        return descriptor;
    }

    private static JObject BuildBatchIndustryRecipeSelector(JObject entry)
    {
        var selector = new JObject();
        if (ReadUInt64Token(entry["recipeId"]).HasValue)
        {
            selector["recipeId"] = ReadUInt64Token(entry["recipeId"])!.Value;
        }

        if (ReadUInt64Token(entry["itemTypeId"]).HasValue)
        {
            selector["itemTypeId"] = ReadUInt64Token(entry["itemTypeId"])!.Value;
        }

        var itemName = entry["itemName"]?.Value<string>()?.Trim();
        if (!string.IsNullOrWhiteSpace(itemName))
        {
            selector["itemName"] = itemName;
        }

        var recipeKey = entry["recipeKey"]?.Value<string>()?.Trim();
        if (!string.IsNullOrWhiteSpace(recipeKey))
        {
            selector["recipeKey"] = recipeKey;
        }

        if (!selector.Properties().Any())
        {
            throw new ToolboxOpsException("industry_batch_recipe_selector_required");
        }

        return selector;
    }

    private bool IndustryRuntimeAlreadyMatches(JObject runtime, ulong desiredRecipeId, string startMode, long? requestedAmount, ulong productItemTypeId)
    {
        return IndustryRuntimeMatchesRecipe(runtime, desiredRecipeId)
            && IndustryRuntimeMatchesStart(runtime, desiredRecipeId, startMode, requestedAmount, productItemTypeId);
    }

    private static bool IndustryRuntimeMatchesRecipe(JObject runtime, ulong desiredRecipeId)
    {
        return IndustryRuntimeRecipeId(runtime) == desiredRecipeId
            && IndustryRuntimeNextRecipeId(runtime) == desiredRecipeId;
    }

    private bool IndustryRuntimeMatchesStart(JObject runtime, ulong desiredRecipeId, string startMode, long? requestedAmount, ulong productItemTypeId)
    {
        if (IndustryRuntimeRecipeId(runtime) != desiredRecipeId)
        {
            return false;
        }

        switch (startMode)
        {
            case "run":
                return !IndustryRuntimeIsStopped(runtime);
            case "make":
            case "move":
                return IndustryRuntimeBatchesRequested(runtime) == (requestedAmount ?? 0)
                    && !IndustryRuntimeIsStopped(runtime);
            case "maintain":
            {
                if (!requestedAmount.HasValue || requestedAmount.Value < 0)
                {
                    return false;
                }

                var expectedRawAmount = ConvertGameplayQuantityToRaw(productItemTypeId, requestedAmount.Value);

                return IndustryRuntimeMaintainAmount(runtime) == expectedRawAmount
                    && IndustryRuntimeBatchesRequested(runtime) == 0
                    && !IndustryRuntimeIsStopped(runtime);
            }
            default:
                return false;
        }
    }

    private static bool IndustryRuntimeIsStopped(JObject runtime)
    {
        return string.Equals(runtime["state"]?.Value<string>(), "STOPPED", StringComparison.OrdinalIgnoreCase);
    }

    private static ulong IndustryRuntimeRecipeId(JObject runtime)
    {
        return ReadUInt64Token(runtime["recipeId"]) ?? 0;
    }

    private static ulong IndustryRuntimeNextRecipeId(JObject runtime)
    {
        return ReadUInt64Token(runtime["nextRecipeId"]) ?? 0;
    }

    private static long IndustryRuntimeMaintainAmount(JObject runtime)
    {
        return runtime["maintainProductAmount"]?.Value<long>() ?? 0;
    }

    private static long IndustryRuntimeBatchesRequested(JObject runtime)
    {
        return runtime["batchesRequested"]?.Value<long>() ?? 0;
    }

    private JObject CreateIndustryBatchOperationFailure(IndustryBatchOperation operation, string error, JObject? details = null)
    {
        var failure = new JObject
        {
            ["index"] = operation.Index,
            ["success"] = false,
            ["error"] = error,
            ["target"] = BuildResolvedIndustryObject(operation.Target),
            ["recipe"] = BuildResolvedIndustryRecipeObject(operation.Recipe),
            ["start"] = new JObject
            {
                ["mode"] = operation.StartMode,
                ["requestedAmount"] = operation.RequestedAmount.HasValue ? new JValue(operation.RequestedAmount.Value) : JValue.CreateNull()
            }
        };
        if (details is not null)
        {
            foreach (var property in details.Properties())
            {
                failure[property.Name] = property.Value;
            }
        }

        return failure;
    }

    private async Task<ResolvedToolboxStorageTarget> ResolveStorageTarget(ulong requesterPlayerId, JObject? selector)
    {
        selector ??= new JObject();
        var storageKind = (selector["storageKind"]?.Value<string>()?.Trim() ?? "container").ToLowerInvariant();
        switch (storageKind)
        {
            case "player_inventory":
            {
                var targetPlayerId = ReadUInt64Token(selector["targetPlayerId"]) ?? requesterPlayerId;
                return new ResolvedToolboxStorageTarget
                {
                    StorageKind = storageKind,
                    RequesterPlayerId = requesterPlayerId,
                    TargetPlayerId = targetPlayerId,
                    StorageRef = StorageRef.PlayerInventory((PlayerId)targetPlayerId),
                    Label = $"player_inventory[{targetPlayerId}]"
                };
            }
            case "player_inventory_raw":
            {
                var targetPlayerId = ReadUInt64Token(selector["targetPlayerId"]) ?? requesterPlayerId;
                return new ResolvedToolboxStorageTarget
                {
                    StorageKind = storageKind,
                    RequesterPlayerId = requesterPlayerId,
                    TargetPlayerId = targetPlayerId,
                    StorageRef = StorageRef.PlayerInventoryWithoutPrimary((PlayerId)targetPlayerId),
                    Label = $"player_inventory_raw[{targetPlayerId}]"
                };
            }
            case "player_primary_container":
            {
                var targetPlayerId = ReadUInt64Token(selector["targetPlayerId"]) ?? requesterPlayerId;
                var dataAccessor = services.GetRequiredService<IDataAccessor>();
                var primaryContainerId = (ulong)await dataAccessor.GetPrimaryContainerAsync((PlayerId)targetPlayerId);
                if (primaryContainerId == 0)
                {
                    throw new InvalidOperationException("primary_container_not_found");
                }

                return new ResolvedToolboxStorageTarget
                {
                    StorageKind = storageKind,
                    RequesterPlayerId = requesterPlayerId,
                    TargetPlayerId = targetPlayerId,
                    ContainerElementId = primaryContainerId,
                    StorageRef = StorageRef.Container((ElementId)primaryContainerId),
                    Label = $"player_primary_container[{targetPlayerId}]={primaryContainerId}"
                };
            }
            case "container":
            case "container_hub":
            {
                var categoryFilter = storageKind;
                return await ResolveConstructStorageTarget(requesterPlayerId, selector, categoryFilter);
            }
            default:
                throw new InvalidOperationException("unsupported_storage_kind");
        }
    }

    private async Task<ResolvedToolboxConstructElementTarget> ResolveConstructElementTarget(ulong requesterPlayerId, JObject? selector)
    {
        selector ??= new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var constructId = requestedConstructId.HasValue && requestedConstructId.Value > 0
            ? (ConstructId)requestedConstructId.Value
            : (await ResolveConstructIdForInspection(requesterPlayerId, null, 0)).ConstructId;
        var usedCurrentConstruct = !requestedConstructId.HasValue || requestedConstructId.Value == 0;
        var context = await LoadConstructInspectionContext(requesterPlayerId, constructId, usedCurrentConstruct);
        var requestedElementId = ReadUInt64Token(selector["elementId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();

        var providedSelectorCount = 0;
        providedSelectorCount += requestedElementId.HasValue && requestedElementId.Value > 0 ? 1 : 0;
        providedSelectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        providedSelectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (providedSelectorCount != 1)
        {
            throw new ToolboxOpsException("element_selector_requires_exactly_one_of_elementId_localId_name");
        }

        IEnumerable<ElementInfo> candidates = context.Elements;
        if (requestedElementId.HasValue && requestedElementId.Value > 0)
        {
            candidates = candidates.Where(element => element.elementId == requestedElementId.Value);
        }
        else if (requestedLocalId.HasValue && requestedLocalId.Value > 0)
        {
            candidates = candidates.Where(element => element.localId == requestedLocalId.Value);
        }
        else
        {
            var exactName = requestedName ?? "";
            candidates = candidates.Where(element =>
                string.Equals(TryReadElementCustomName(element), exactName, StringComparison.OrdinalIgnoreCase)
                || string.Equals(ResolveElementTypeName(context, element), exactName, StringComparison.OrdinalIgnoreCase));
        }

        var matches = candidates.ToList();
        if (matches.Count == 0)
        {
            throw new ToolboxOpsException("element_target_not_found");
        }

        if (matches.Count > 1)
        {
            throw new ToolboxOpsException(
                "element_target_ambiguous",
                new JObject
                {
                    ["candidates"] = new JArray(matches.Take(20).Select(element => BuildElementSummary(context, element)))
                });
        }

        var elementMatch = matches[0];
        return new ResolvedToolboxConstructElementTarget
        {
            RequesterPlayerId = requesterPlayerId,
            ConstructContext = context,
            Element = elementMatch,
            UsedCurrentConstruct = usedCurrentConstruct,
            Label = string.IsNullOrWhiteSpace(TryReadElementCustomName(elementMatch))
                ? $"{ResolveElementTypeName(context, elementMatch)} [{elementMatch.localId}]"
                : TryReadElementCustomName(elementMatch)!
        };
    }

    private async Task<ResolvedToolboxStorageTarget> ResolveConstructStorageTarget(ulong requesterPlayerId, JObject selector, string fallbackCategory)
    {
        var categoryFilter = selector["category"]?.Value<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(categoryFilter))
        {
            categoryFilter = fallbackCategory;
        }

        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var constructId = requestedConstructId.HasValue && requestedConstructId.Value > 0
            ? (ConstructId)requestedConstructId.Value
            : (await ResolveConstructIdForInspection(requesterPlayerId, null, 0)).ConstructId;
        var usedCurrentConstruct = !requestedConstructId.HasValue || requestedConstructId.Value == 0;
        var context = await LoadConstructInspectionContext(requesterPlayerId, constructId, usedCurrentConstruct);
        var requestedElementId = ReadUInt64Token(selector["elementId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();

        var providedSelectorCount = 0;
        providedSelectorCount += requestedElementId.HasValue && requestedElementId.Value > 0 ? 1 : 0;
        providedSelectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        providedSelectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (providedSelectorCount != 1)
        {
            throw new InvalidOperationException("storage_selector_requires_exactly_one_of_elementId_localId_name");
        }

        IEnumerable<ElementInfo> candidates = context.Elements;
        if (!string.IsNullOrWhiteSpace(categoryFilter))
        {
            candidates = candidates.Where(element => string.Equals(
                ResolveElementCategory(context, element),
                categoryFilter,
                StringComparison.OrdinalIgnoreCase));
        }

        if (requestedElementId.HasValue && requestedElementId.Value > 0)
        {
            candidates = candidates.Where(element => element.elementId == requestedElementId.Value);
        }
        else if (requestedLocalId.HasValue && requestedLocalId.Value > 0)
        {
            candidates = candidates.Where(element => element.localId == requestedLocalId.Value);
        }
        else
        {
            var exactName = requestedName ?? "";
            candidates = candidates.Where(element =>
                string.Equals(TryReadElementCustomName(element), exactName, StringComparison.OrdinalIgnoreCase)
                || string.Equals(ResolveElementTypeName(context, element), exactName, StringComparison.OrdinalIgnoreCase));
        }

        var matches = candidates.ToList();
        if (matches.Count == 0)
        {
            throw new ToolboxOpsException("storage_target_not_found");
        }

        if (matches.Count > 1)
        {
            throw new ToolboxOpsException(
                "storage_target_ambiguous",
                new JObject
                {
                    ["candidates"] = new JArray(matches.Take(20).Select(element => BuildElementSummary(context, element)))
                });
        }

        var elementMatch = matches[0];
        var category = ResolveElementCategory(context, elementMatch);
        if (!SupportsStorageRuntime(category))
        {
            throw new InvalidOperationException("resolved_element_is_not_storage");
        }

        return new ResolvedToolboxStorageTarget
        {
            StorageKind = category,
            RequesterPlayerId = requesterPlayerId,
            TargetPlayerId = requesterPlayerId,
            ContainerElementId = elementMatch.elementId,
            StorageRef = StorageRef.Container((ElementId)elementMatch.elementId),
            Label = string.IsNullOrWhiteSpace(TryReadElementCustomName(elementMatch))
                ? $"{ResolveElementTypeName(context, elementMatch)} [{elementMatch.localId}]"
                : TryReadElementCustomName(elementMatch)!,
            ConstructContext = context,
            Element = elementMatch,
            UsedCurrentConstruct = usedCurrentConstruct
        };
    }

    private async Task<ResolvedToolboxIndustryTarget> ResolveIndustryTarget(ulong requesterPlayerId, JObject? selector)
    {
        selector ??= new JObject();
        var requestedConstructId = ReadUInt64Token(selector["constructId"]);
        var constructId = requestedConstructId.HasValue && requestedConstructId.Value > 0
            ? (ConstructId)requestedConstructId.Value
            : (await ResolveConstructIdForInspection(requesterPlayerId, null, 0)).ConstructId;
        var usedCurrentConstruct = !requestedConstructId.HasValue || requestedConstructId.Value == 0;
        var context = await LoadConstructInspectionContext(requesterPlayerId, constructId, usedCurrentConstruct);
        var requestedElementId = ReadUInt64Token(selector["elementId"]);
        var requestedLocalId = ReadUInt64Token(selector["localId"]);
        var requestedName = selector["name"]?.Value<string>()?.Trim();

        var providedSelectorCount = 0;
        providedSelectorCount += requestedElementId.HasValue && requestedElementId.Value > 0 ? 1 : 0;
        providedSelectorCount += requestedLocalId.HasValue && requestedLocalId.Value > 0 ? 1 : 0;
        providedSelectorCount += string.IsNullOrWhiteSpace(requestedName) ? 0 : 1;
        if (providedSelectorCount != 1)
        {
            throw new ToolboxOpsException("industry_selector_requires_exactly_one_of_elementId_localId_name");
        }

        IEnumerable<ElementInfo> candidates = context.Elements.Where(element => SupportsIndustryMutationTarget(element));
        if (requestedElementId.HasValue && requestedElementId.Value > 0)
        {
            candidates = candidates.Where(element => element.elementId == requestedElementId.Value);
        }
        else if (requestedLocalId.HasValue && requestedLocalId.Value > 0)
        {
            candidates = candidates.Where(element => element.localId == requestedLocalId.Value);
        }
        else
        {
            var exactName = requestedName ?? "";
            candidates = candidates.Where(element =>
                string.Equals(TryReadElementCustomName(element), exactName, StringComparison.OrdinalIgnoreCase)
                || string.Equals(ResolveElementTypeName(context, element), exactName, StringComparison.OrdinalIgnoreCase));
        }

        var matches = candidates.ToList();
        if (matches.Count == 0)
        {
            throw new ToolboxOpsException("industry_target_not_found");
        }

        if (matches.Count > 1)
        {
            throw new ToolboxOpsException(
                "industry_target_ambiguous",
                new JObject
                {
                    ["candidates"] = new JArray(matches.Take(20).Select(element => BuildElementSummary(context, element)))
                });
        }

        var elementMatch = matches[0];
        return new ResolvedToolboxIndustryTarget
        {
            RequesterPlayerId = requesterPlayerId,
            ConstructContext = context,
            Element = elementMatch,
            UsedCurrentConstruct = usedCurrentConstruct,
            IndustryKind = ResolveIndustryKind(elementMatch),
            Label = string.IsNullOrWhiteSpace(TryReadElementCustomName(elementMatch))
                ? $"{ResolveElementTypeName(context, elementMatch)} [{elementMatch.localId}]"
                : TryReadElementCustomName(elementMatch)!
        };
    }

    private async Task<ResolvedToolboxIndustryRecipe> ResolveIndustryRecipeTarget(ResolvedToolboxIndustryTarget target, JObject? selector)
    {
        selector ??= new JObject();
        var explicitRecipeId = ReadUInt64Token(selector["recipeId"]);
        var explicitRecipeKey = selector["recipeKey"]?.Value<string>()?.Trim();
        if (explicitRecipeId.HasValue && explicitRecipeId.Value > 0)
        {
            if (string.Equals(target.IndustryKind, "transfer", StringComparison.OrdinalIgnoreCase))
            {
                var explicitItem = ResolveInventoryItem(new JObject
                {
                    ["itemTypeId"] = explicitRecipeId.Value
                });
                var resolvedTransferRecipe = new ResolvedToolboxIndustryRecipe
                {
                    RecipeId = explicitRecipeId.Value,
                    RecipeKind = "transfer_item_type",
                    ProductItemTypeId = explicitItem.ItemTypeId,
                    ProductItemName = explicitItem.ItemName
                };
                ApplyEmbeddedIndustryRecipeReference(
                    resolvedTransferRecipe,
                    FindEmbeddedIndustryRecipeReference(recipeId: 0, productItemTypeId: explicitItem.ItemTypeId));
                return resolvedTransferRecipe;
            }

            var recipes = services.GetRequiredService<IRecipes>();
            var recipe = await recipes.GetRecipe(explicitRecipeId.Value);
            if (recipe is null)
            {
                throw new ToolboxOpsException("recipe_not_found");
            }

            if (recipe.producers is null || !recipe.producers.Contains(target.Element.elementType))
            {
                throw new ToolboxOpsException("recipe_not_valid_for_target");
            }

            var product = recipe.products?.FirstOrDefault();
            var resolvedRecipeById = new ResolvedToolboxIndustryRecipe
            {
                RecipeId = recipe.id,
                RecipeKind = "industry_recipe",
                ProductItemTypeId = product?.itemId ?? 0,
                ProductItemName = product is null ? "" : ResolveItemTypeName(0, product.itemId),
                Recipe = recipe
            };
            ApplyEmbeddedIndustryRecipeReference(
                resolvedRecipeById,
                FindEmbeddedIndustryRecipeReference(recipe.id, resolvedRecipeById.ProductItemTypeId));
            return resolvedRecipeById;
        }

        if (!string.IsNullOrWhiteSpace(explicitRecipeKey))
        {
            var embeddedReference = ResolveEmbeddedIndustryRecipeReference(explicitRecipeKey);
            if (string.Equals(target.IndustryKind, "transfer", StringComparison.OrdinalIgnoreCase))
            {
                if (embeddedReference.ProductItemTypeId == 0)
                {
                    throw new ToolboxOpsException("recipe_key_missing_product_item_type");
                }

                var resolvedTransferRecipe = new ResolvedToolboxIndustryRecipe
                {
                    RecipeId = embeddedReference.ProductItemTypeId,
                    RecipeKind = "transfer_item_type",
                    ProductItemTypeId = embeddedReference.ProductItemTypeId,
                    ProductItemName = embeddedReference.ProductItemName
                };
                ApplyEmbeddedIndustryRecipeReference(resolvedTransferRecipe, embeddedReference);
                return resolvedTransferRecipe;
            }

            if (embeddedReference.RecipeId == 0)
            {
                throw new ToolboxOpsException("recipe_key_missing_recipe_id");
            }

            var recipes = services.GetRequiredService<IRecipes>();
            var recipe = await recipes.GetRecipe(embeddedReference.RecipeId);
            if (recipe is null)
            {
                throw new ToolboxOpsException("recipe_not_found");
            }

            if (recipe.producers is null || !recipe.producers.Contains(target.Element.elementType))
            {
                throw new ToolboxOpsException("recipe_not_valid_for_target");
            }

            var product = recipe.products?.FirstOrDefault();
            var resolvedRecipeByKey = new ResolvedToolboxIndustryRecipe
            {
                RecipeId = recipe.id,
                RecipeKind = "industry_recipe",
                ProductItemTypeId = product?.itemId ?? embeddedReference.ProductItemTypeId,
                ProductItemName = product is null ? embeddedReference.ProductItemName : ResolveItemTypeName(0, product.itemId),
                Recipe = recipe
            };
            ApplyEmbeddedIndustryRecipeReference(resolvedRecipeByKey, embeddedReference);
            return resolvedRecipeByKey;
        }

        var item = ResolveInventoryItem(selector);
        if (string.Equals(target.IndustryKind, "transfer", StringComparison.OrdinalIgnoreCase))
        {
            var resolvedTransferRecipe = new ResolvedToolboxIndustryRecipe
            {
                RecipeId = item.ItemTypeId,
                RecipeKind = "transfer_item_type",
                ProductItemTypeId = item.ItemTypeId,
                ProductItemName = item.ItemName
            };
            ApplyEmbeddedIndustryRecipeReference(
                resolvedTransferRecipe,
                FindEmbeddedIndustryRecipeReference(recipeId: 0, productItemTypeId: item.ItemTypeId));
            return resolvedTransferRecipe;
        }

        var recipesService = services.GetRequiredService<IRecipes>();
        var matchingRecipes = (await recipesService.GetProducing(item.ItemTypeId))
            .Where(recipe => recipe.producers is not null && recipe.producers.Contains(target.Element.elementType))
            .Where(recipe => recipe.products is not null && recipe.products.Any(product => product.itemId == item.ItemTypeId))
            .GroupBy(recipe => recipe.id)
            .Select(group => group.First())
            .OrderBy(recipe => recipe.id)
            .ToList();

        if (matchingRecipes.Count == 0)
        {
            throw new ToolboxOpsException("recipe_not_found_for_target");
        }

        if (matchingRecipes.Count > 1)
        {
            throw new ToolboxOpsException(
                "recipe_ambiguous_for_target",
                new JObject
                {
                    ["candidates"] = new JArray(matchingRecipes.Take(20).Select(BuildRecipeCandidateObject))
                });
        }

        var resolvedRecipeByItem = new ResolvedToolboxIndustryRecipe
        {
            RecipeId = matchingRecipes[0].id,
            RecipeKind = "industry_recipe",
            ProductItemTypeId = item.ItemTypeId,
            ProductItemName = item.ItemName,
            Recipe = matchingRecipes[0]
        };
        ApplyEmbeddedIndustryRecipeReference(
            resolvedRecipeByItem,
            FindEmbeddedIndustryRecipeReference(matchingRecipes[0].id, item.ItemTypeId));
        return resolvedRecipeByItem;
    }

    private JObject BuildResolvedStorageObject(ResolvedToolboxStorageTarget resolved)
    {
        var obj = new JObject
        {
            ["storageKind"] = resolved.StorageKind,
            ["label"] = resolved.Label,
            ["targetPlayerId"] = resolved.TargetPlayerId == 0 ? JValue.CreateNull() : resolved.TargetPlayerId,
            ["containerElementId"] = resolved.ContainerElementId.HasValue ? new JValue(resolved.ContainerElementId.Value) : JValue.CreateNull()
        };

        if (resolved.ConstructContext is not null)
        {
            obj["construct"] = BuildConstructDescriptor(resolved.ConstructContext);
        }
        else
        {
            obj["construct"] = JValue.CreateNull();
        }

        if (resolved.Element is not null && resolved.ConstructContext is not null)
        {
            obj["element"] = BuildElementSummary(resolved.ConstructContext, resolved.Element);
        }
        else
        {
            obj["element"] = JValue.CreateNull();
        }

        return obj;
    }

    private JObject BuildResolvedIndustryObject(ResolvedToolboxIndustryTarget target)
    {
        return new JObject
        {
            ["label"] = target.Label,
            ["industryKind"] = target.IndustryKind,
            ["construct"] = BuildConstructDescriptor(target.ConstructContext),
            ["element"] = BuildElementSummary(target.ConstructContext, target.Element)
        };
    }

    private JObject BuildResolvedConstructElementObject(ResolvedToolboxConstructElementTarget target)
    {
        return new JObject
        {
            ["label"] = target.Label,
            ["construct"] = BuildConstructDescriptor(target.ConstructContext),
            ["element"] = BuildElementSummary(target.ConstructContext, target.Element)
        };
    }

    private JObject BuildResolvedElementLinkObject(ConstructInspectionContext context, LinkInfo link, ElementInfo? fromElement = null, ElementInfo? toElement = null)
    {
        var resolvedFrom = fromElement
            ?? (context.ElementsById.TryGetValue(link.fromElementId, out var fromMatch)
                ? fromMatch
                : new ElementInfo { elementId = link.fromElementId, constructId = link.constructId });
        var resolvedTo = toElement
            ?? (context.ElementsById.TryGetValue(link.toElementId, out var toMatch)
                ? toMatch
                : new ElementInfo { elementId = link.toElementId, constructId = link.constructId });
        return new JObject
        {
            ["constructId"] = link.constructId,
            ["plugType"] = link.plugType.ToString(),
            ["fromPlug"] = link.fromPlug,
            ["toPlug"] = link.toPlug,
            ["from"] = BuildElementSummary(context, resolvedFrom),
            ["to"] = BuildElementSummary(context, resolvedTo)
        };
    }

    private JObject BuildResolvedIndustryRecipeObject(ResolvedToolboxIndustryRecipe recipe)
    {
        var obj = new JObject
        {
            ["recipeId"] = recipe.RecipeId,
            ["recipeKind"] = recipe.RecipeKind,
            ["productItemTypeId"] = recipe.ProductItemTypeId,
            ["productItemName"] = recipe.ProductItemName,
            ["recipeKey"] = string.IsNullOrWhiteSpace(recipe.RecipeKey) ? JValue.CreateNull() : recipe.RecipeKey,
            ["productTypeKey"] = string.IsNullOrWhiteSpace(recipe.ProductTypeKey) ? JValue.CreateNull() : recipe.ProductTypeKey,
            ["industry"] = string.IsNullOrWhiteSpace(recipe.IndustryName) ? JValue.CreateNull() : recipe.IndustryName,
            ["parentGroupName"] = string.IsNullOrWhiteSpace(recipe.ParentGroupName) ? JValue.CreateNull() : recipe.ParentGroupName
        };
        if (recipe.Recipe is not null)
        {
            obj["time"] = recipe.Recipe.time;
            obj["producerTypeIds"] = new JArray((recipe.Recipe.producers ?? new List<ulong>()).Select(value => new JValue(value)));
            obj["products"] = new JArray((recipe.Recipe.products ?? new List<Ingredient>()).Select(product => new JObject
            {
                ["itemTypeId"] = product.itemId,
                ["itemName"] = ResolveItemTypeName(0, product.itemId),
                ["rawQuantity"] = product.quantity.value,
                ["quantity"] = ConvertRawQuantityToDisplay(product.itemId, product.quantity.value)
            }));
        }
        else
        {
            obj["time"] = JValue.CreateNull();
            obj["producerTypeIds"] = new JArray();
            obj["products"] = new JArray();
        }

        return obj;
    }

    private static JObject BuildQuatObject(Quat value)
    {
        return new JObject
        {
            ["x"] = value.x,
            ["y"] = value.y,
            ["z"] = value.z,
            ["w"] = value.w
        };
    }

    private JObject BuildIndustryRuntimeRecipeObject(Recipe? recipe)
    {
        if (recipe is null)
        {
            return new JObject
            {
                ["recipeId"] = 0,
                ["time"] = JValue.CreateNull(),
                ["producerTypeIds"] = new JArray(),
                ["ingredients"] = new JArray(),
                ["products"] = new JArray()
            };
        }

        return new JObject
        {
            ["recipeId"] = recipe.id,
            ["time"] = recipe.time,
            ["producerTypeIds"] = new JArray((recipe.producers ?? new List<ulong>()).Select(value => new JValue(value))),
            ["ingredients"] = new JArray((recipe.ingredients ?? new List<Ingredient>()).Select(ingredient => new JObject
            {
                ["itemTypeId"] = ingredient.itemId,
                ["itemName"] = ResolveItemTypeName(0, ingredient.itemId),
                ["rawQuantity"] = ingredient.quantity.value,
                ["quantity"] = ConvertRawQuantityToDisplay(ingredient.itemId, ingredient.quantity.value)
            })),
            ["products"] = new JArray((recipe.products ?? new List<Ingredient>()).Select(product => new JObject
            {
                ["itemTypeId"] = product.itemId,
                ["itemName"] = ResolveItemTypeName(0, product.itemId),
                ["rawQuantity"] = product.quantity.value,
                ["quantity"] = ConvertRawQuantityToDisplay(product.itemId, product.quantity.value)
            }))
        };
    }

    private JObject BuildStorageSnapshot(StorageInfo storage, string category, int itemLimit)
    {
        var items = storage.content
            .Where(slot => slot.quantity.value > 0)
            .OrderBy(slot => slot.position)
            .Take(itemLimit)
            .Select(BuildStorageSlotObject);

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
            ["slotPositions"] = new JArray(storage.content
                .Where(slot => slot.quantity.value > 0)
                .OrderBy(slot => slot.position)
                .Select(slot => slot.position)),
            ["uniqueItemTypes"] = storage.content
                .Where(slot => slot.quantity.value > 0)
                .Select(slot => slot.content.type)
                .Distinct()
                .Count(),
            ["items"] = new JArray(items)
        };
    }

    private JObject BuildStorageSlotObject(StorageSlot slot)
    {
        var displayQuantity = ConvertRawQuantityToDisplay(slot.content.type, slot.quantity.value);
        return new JObject
        {
            ["slot"] = slot.position,
            ["itemTypeId"] = slot.content.type,
            ["itemName"] = ResolveItemTypeName(0, slot.content.type),
            ["itemId"] = slot.content.id,
            ["rawQuantity"] = slot.quantity.value,
            ["quantity"] = displayQuantity
        };
    }

    private (ulong ItemTypeId, string ItemName) ResolveInventoryItem(JObject? selector)
    {
        selector ??= new JObject();
        var itemTypeId = ReadUInt64Token(selector["itemTypeId"]);
        var itemName = selector["itemName"]?.Value<string>()?.Trim();
        if (itemTypeId.HasValue && itemTypeId.Value > 0)
        {
            var definition = services.GetRequiredService<IGameplayBank>().GetDefinition(itemTypeId.Value);
            if (definition is null || definition.BaseObject is not BaseItem)
            {
                throw new ToolboxOpsException("item_type_not_found");
            }

            return (itemTypeId.Value, definition.Name);
        }

        if (string.IsNullOrWhiteSpace(itemName))
        {
            throw new ToolboxOpsException("missing_item_selector");
        }

        var bank = services.GetRequiredService<IGameplayBank>();
        var matches = bank.GetInventoryDefinitions()
            .Where(def => string.Equals(def.Name, itemName, StringComparison.OrdinalIgnoreCase))
            .Select(def => new { def.Id, def.Name })
            .Distinct()
            .ToList();
        if (matches.Count == 0)
        {
            // Fallback: try the item bank SQLite database by display name or json key
            var itemBankResult = TryResolveItemNameThroughItemBank(itemName);
            if (itemBankResult.HasValue)
            {
                var (nqId, jsonKey) = itemBankResult.Value;
                var definitionById = bank.GetDefinition((ulong)nqId);
                if (definitionById is not null && definitionById.BaseObject is BaseItem)
                {
                    return ((ulong)nqId, definitionById.Name);
                }
                // The nqId exists in the item bank but not in IGameplayBank yet;
                // try the json key as a name against IGameplayBank as last resort
                var matchesByKey = bank.GetInventoryDefinitions()
                    .Where(def => string.Equals(def.Name, jsonKey, StringComparison.OrdinalIgnoreCase))
                    .Select(def => new { def.Id, def.Name })
                    .Distinct()
                    .ToList();
                if (matchesByKey.Count == 1)
                {
                    return (matchesByKey[0].Id, matchesByKey[0].Name);
                }
            }

            throw new ToolboxOpsException("item_name_not_found");
        }

        if (matches.Count > 1)
        {
            throw new ToolboxOpsException(
                "item_name_ambiguous",
                new JObject
                {
                    ["candidates"] = new JArray(matches.Select(match => new JObject
                    {
                        ["itemTypeId"] = match.Id,
                        ["itemName"] = match.Name
                    }))
                });
        }

        return (matches[0].Id, matches[0].Name);
    }

    private EmbeddedIndustryRecipeReference ResolveEmbeddedIndustryRecipeReference(string recipeKey)
    {
        var catalog = GetEmbeddedIndustryRecipeCatalog();
        if (catalog.ByRecipeKey.TryGetValue(recipeKey, out var embeddedReference))
        {
            return embeddedReference;
        }

        throw new ToolboxOpsException("recipe_key_not_found");
    }

    private EmbeddedIndustryRecipeReference? FindEmbeddedIndustryRecipeReference(ulong recipeId, ulong productItemTypeId)
    {
        var catalog = GetEmbeddedIndustryRecipeCatalog();
        if (recipeId > 0 && catalog.ByRecipeId.TryGetValue(recipeId, out var byRecipeId))
        {
            return byRecipeId;
        }

        if (productItemTypeId > 0 && catalog.ByProductItemTypeId.TryGetValue(productItemTypeId, out var byProductItemTypeId))
        {
            return byProductItemTypeId;
        }

        return null;
    }

    private IReadOnlyList<EmbeddedIndustryRecipeReference> ResolveEmbeddedIndustryRecipeReferencesByProductName(string itemName)
    {
        if (string.IsNullOrWhiteSpace(itemName))
        {
            return Array.Empty<EmbeddedIndustryRecipeReference>();
        }

        var catalog = GetEmbeddedIndustryRecipeCatalog();
        return catalog.ByProductName.TryGetValue(itemName.Trim(), out var matches)
            ? matches
            : Array.Empty<EmbeddedIndustryRecipeReference>();
    }

    private IReadOnlyList<EmbeddedIndustryRecipeReference> ResolveEmbeddedIndustryRecipeReferencesByIngredientName(string itemName)
    {
        if (string.IsNullOrWhiteSpace(itemName))
        {
            return Array.Empty<EmbeddedIndustryRecipeReference>();
        }

        var catalog = GetEmbeddedIndustryRecipeCatalog();
        return catalog.ByIngredientName.TryGetValue(itemName.Trim(), out var matches)
            ? matches
            : Array.Empty<EmbeddedIndustryRecipeReference>();
    }

    private void ApplyEmbeddedIndustryRecipeReference(ResolvedToolboxIndustryRecipe resolvedRecipe, EmbeddedIndustryRecipeReference? embeddedReference)
    {
        if (embeddedReference is null)
        {
            return;
        }

        resolvedRecipe.RecipeKey = embeddedReference.RecipeKey;
        resolvedRecipe.ProductTypeKey = embeddedReference.ProductTypeKey;
        resolvedRecipe.IndustryName = embeddedReference.IndustryName;
        resolvedRecipe.ParentGroupName = embeddedReference.ParentGroupName;
        if (string.IsNullOrWhiteSpace(resolvedRecipe.ProductItemName))
        {
            resolvedRecipe.ProductItemName = embeddedReference.ProductItemName;
        }
    }

    private EmbeddedIndustryRecipeCatalog GetEmbeddedIndustryRecipeCatalog()
    {
        if (embeddedIndustryRecipeCatalog is not null)
        {
            return embeddedIndustryRecipeCatalog;
        }

        lock (embeddedIndustryRecipeCatalogGate)
        {
            if (embeddedIndustryRecipeCatalog is null)
            {
                embeddedIndustryRecipeCatalog = LoadEmbeddedIndustryRecipeCatalog();
            }

            return embeddedIndustryRecipeCatalog;
        }
    }

    private EmbeddedIndustryRecipeCatalog LoadEmbeddedIndustryRecipeCatalog()
    {
        return LoadIndustryRecipeCatalogFromItemBank();
    }

    private StorageSlot RequireOccupiedSlot(StorageInfo storage, int slotIndex, string methodName)
    {
        var slot = storage.content.FirstOrDefault(candidate => candidate.position == slotIndex && candidate.quantity.value > 0);
        if (slot is null)
        {
            throw new InvalidOperationException(methodName + "_source_slot_not_found");
        }

        return slot;
    }

    private static int FindFirstAvailableSlot(StorageInfo storage)
    {
        var usedSlots = new HashSet<int>(storage.content
            .Where(slot => slot.quantity.value > 0)
            .Select(slot => slot.position));
        var next = 0;
        while (usedSlots.Contains(next))
        {
            next += 1;
        }

        return next;
    }

    private long ConvertGameplayQuantityToRaw(ulong itemTypeId, long requestedQuantity)
    {
        if (requestedQuantity <= 0)
        {
            return 0;
        }

        var bank = services.GetRequiredService<IGameplayBank>();
        return bank.QuantityFromGDValue(itemTypeId, requestedQuantity);
    }

    private decimal ConvertRawQuantityToDisplay(ulong itemTypeId, long rawQuantity)
    {
        var definition = services.GetRequiredService<IGameplayBank>().GetDefinition(itemTypeId);
        if (definition?.BaseObject is Material)
        {
            return rawQuantity / 16777216m;
        }

        return rawQuantity;
    }

    private string ResolveResolvedStorageCategory(ResolvedToolboxStorageTarget resolved)
    {
        if (resolved.Element is not null && resolved.ConstructContext is not null)
        {
            return ResolveElementCategory(resolved.ConstructContext, resolved.Element);
        }

        return resolved.StorageKind;
    }

    private bool SupportsIndustryMutationTarget(ElementInfo element)
    {
        var definition = services.GetRequiredService<IGameplayBank>().GetDefinition(element.elementType);
        if (definition?.BaseObject is null)
        {
            return false;
        }

        return definition.Is<IndustryUnit>() || definition.Is<TransferUnit>();
    }

    private string ResolveIndustryKind(ElementInfo element)
    {
        var definition = services.GetRequiredService<IGameplayBank>().GetDefinition(element.elementType);
        if (definition?.BaseObject is null)
        {
            return "unknown";
        }

        if (definition.Is<TransferUnit>())
        {
            return "transfer";
        }

        if (definition.Is<IndustryUnit>())
        {
            return "industry";
        }

        return "unknown";
    }

    private async Task<bool> HasDevCraftingSpeedTalent(ulong playerId)
    {
        if (playerId == 0)
        {
            return false;
        }

        if (hasDevCraftingSpeedTalentByPlayer.TryGetValue(playerId, out var cached))
        {
            return cached;
        }

        var sql = services.GetService<ISql>();
        if (sql is null)
        {
            logger.LogWarning(
                "UIToolbox could not check DevCraftingSpeed for player {PlayerId}: SQL service unavailable",
                playerId);
            hasDevCraftingSpeedTalentByPlayer[playerId] = false;
            return false;
        }

        try
        {
            var hasTalent = await sql.QueryRow<bool>(
                "SELECT EXISTS (SELECT 1 FROM talent_state WHERE player_id = @1 AND talent = @2);",
                (long)playerId,
                (long)DevCraftingSpeedTalentId);
            hasDevCraftingSpeedTalentByPlayer[playerId] = hasTalent;
            return hasTalent;
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "UIToolbox failed to check DevCraftingSpeed for player {PlayerId}",
                playerId);
            hasDevCraftingSpeedTalentByPlayer[playerId] = false;
            return false;
        }
    }

    private async Task WarnIfRequesterHasDevCraftingSpeedTalentOnce(ulong requesterPlayerId, string methodName)
    {
        if (!await HasDevCraftingSpeedTalent(requesterPlayerId))
        {
            return;
        }

        if (!warnedDevCraftingSpeedTalentPlayers.TryAdd(requesterPlayerId, 0))
        {
            return;
        }

        logger.LogWarning(
            "UIToolbox detected DevCraftingSpeed on player {PlayerId} during {MethodName}. This dev talent can distort industry recipe time and batch size. talentId={TalentId}",
            requesterPlayerId,
            methodName,
            DevCraftingSpeedTalentId);
    }

    private JObject BuildRecipeCandidateObject(Recipe recipe)
    {
        var product = recipe.products?.FirstOrDefault();
        return new JObject
        {
            ["recipeId"] = recipe.id,
            ["time"] = recipe.time,
            ["productItemTypeId"] = product?.itemId ?? 0,
            ["productItemName"] = product is null ? "" : ResolveItemTypeName(0, product.itemId),
            ["producerTypeIds"] = new JArray((recipe.producers ?? new List<ulong>()).Select(value => new JValue(value)))
        };
    }

    private static JObject CreateToolboxOpsFailure(string commandId, string probeMethod, string error, JObject? details = null)
    {
        var failure = new JObject
        {
            ["commandId"] = commandId,
            ["success"] = false,
            ["error"] = error,
            ["method"] = probeMethod
        };
        if (details is not null)
        {
            foreach (var property in details.Properties())
            {
                failure[property.Name] = property.Value;
            }
        }

        return failure;
    }

    private static JObject CreateStorageBatchEntryFailure(int index, string error, JObject? details = null)
    {
        var failure = new JObject
        {
            ["index"] = index,
            ["success"] = false,
            ["error"] = error
        };
        if (details is not null)
        {
            foreach (var property in details.Properties())
            {
                failure[property.Name] = property.Value;
            }
        }

        return failure;
    }

    private static JObject? ReadProbeArgObject(JArray? probeArgs, int index)
    {
        if (probeArgs is null || index < 0 || index >= probeArgs.Count)
        {
            return null;
        }

        return probeArgs[index] as JObject;
    }

    private static double? ReadDoubleToken(JToken? token)
    {
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return null;
        }

        if (token.Type == JTokenType.Float || token.Type == JTokenType.Integer)
        {
            return token.Value<double>();
        }

        var raw = token.Value<string>()?.Trim();
        return double.TryParse(raw, NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }

    private static float? ReadFloatToken(JToken? token)
    {
        var value = ReadDoubleToken(token);
        return value.HasValue ? (float)value.Value : null;
    }

    private static PlugType? ReadPlugTypeToken(JToken? token)
    {
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return null;
        }

        if (token.Type == JTokenType.Integer)
        {
            return (PlugType)token.Value<int>();
        }

        var raw = token.Value<string>()?.Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        return Enum.TryParse<PlugType>(raw, true, out var value) ? value : null;
    }

    private static Vec3? ReadVec3Token(JToken? token)
    {
        if (token is not JObject obj)
        {
            return null;
        }

        var x = ReadDoubleToken(obj["x"]);
        var y = ReadDoubleToken(obj["y"]);
        var z = ReadDoubleToken(obj["z"]);
        if (!x.HasValue || !y.HasValue || !z.HasValue)
        {
            return null;
        }

        return new Vec3
        {
            x = x.Value,
            y = y.Value,
            z = z.Value
        };
    }

    private static Quat? ReadQuatToken(JToken? token)
    {
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return null;
        }

        if (token is not JObject obj)
        {
            return null;
        }

        var x = ReadFloatToken(obj["x"]);
        var y = ReadFloatToken(obj["y"]);
        var z = ReadFloatToken(obj["z"]);
        var w = ReadFloatToken(obj["w"]);
        if (!x.HasValue || !y.HasValue || !z.HasValue || !w.HasValue)
        {
            return null;
        }

        return new Quat
        {
            x = x.Value,
            y = y.Value,
            z = z.Value,
            w = w.Value
        };
    }

    private static JObject MergeSelectorWithConstructId(JObject? selector, ulong? constructId)
    {
        var merged = selector is null ? new JObject() : new JObject(selector);
        if (constructId.HasValue && constructId.Value > 0 && merged["constructId"] is null)
        {
            merged["constructId"] = constructId.Value;
        }

        return merged;
    }

    private RelativeLocation? BuildRelativeLocation(JObject request, ConstructId constructId)
    {
        var position = ReadVec3Token(request["position"]);
        if (!position.HasValue)
        {
            return null;
        }

        var rotation = ReadQuatToken(request["rotation"]) ?? Quat.Identity;
        return RelativeLocation.From(position.Value, constructId, rotation);
    }

    private async Task<StorageSlot> ResolveElementDeploySourceSlot(ulong requesterPlayerId, int slotIndex)
    {
        var storageService = services.GetRequiredService<IItemStorageService>();
        var playerId = (PlayerId)requesterPlayerId;
        var playerInventory = orleans.GetPlayerInventoryGrain(playerId);
        var primaryStatus = await playerInventory.GetPrimaryContainerState();

        StorageRef sourceStorage;
        if (primaryStatus is not null
            && primaryStatus.elementId > 0
            && primaryStatus.isDefault
            && primaryStatus.hasRight
            && !primaryStatus.isBroken
            && !primaryStatus.isTooFar)
        {
            var activeContainerId = primaryStatus.rootId > 0 ? primaryStatus.rootId : primaryStatus.elementId;
            sourceStorage = StorageRef.Container((ElementId)activeContainerId);
        }
        else
        {
            sourceStorage = StorageRef.PlayerInventoryWithoutPrimary(playerId);
        }

        var inventory = await storageService.Get(sourceStorage, playerId);
        var slot = inventory.content.FirstOrDefault(candidate => candidate.position == slotIndex && candidate.quantity.value > 0);
        if (slot is null)
        {
            throw new ToolboxOpsException("inventory_slot_not_found");
        }

        return slot;
    }

    private static ulong? ReadUInt64Token(JToken? token)
    {
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

    private static int? ReadInt32Token(JToken? token)
    {
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return null;
        }

        if (token.Type == JTokenType.Integer)
        {
            return token.Value<int>();
        }

        var raw = token.Value<string>()?.Trim();
        return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }

    private static long? ReadInt64Token(JToken? token)
    {
        if (token is null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
        {
            return null;
        }

        if (token.Type == JTokenType.Integer)
        {
            return token.Value<long>();
        }

        var raw = token.Value<string>()?.Trim();
        return long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }

    private static int ClampInt32(int? value, int min, int max, int fallback)
    {
        var resolved = value ?? fallback;
        if (resolved < min)
        {
            return min;
        }

        if (resolved > max)
        {
            return max;
        }

        return resolved;
    }

    private static int? ReadProbeArgInt32(JArray? probeArgs, int index)
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
            return token.Value<int>();
        }

        var raw = token.Value<string>()?.Trim();
        return int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }

    private static long? ReadProbeArgInt64(JArray? probeArgs, int index)
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
            return token.Value<long>();
        }

        var raw = token.Value<string>()?.Trim();
        return long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;
    }
}
