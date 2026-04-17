using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

sealed class ItemBankItemRow
{
    public long NqId { get; set; }
    public string Name { get; set; } = "";
    public long RecipeId { get; set; }
    public string GroupId { get; set; } = "";
    public string GroupName { get; set; } = "";
    public int Level { get; set; }
    public string? Size { get; set; }
    public string? Industry { get; set; }
    public double UnitMass { get; set; }
    public double UnitVolume { get; set; }
    public bool Nanocraftable { get; set; }
    public string JsonKey { get; set; } = "";
    public string? SchemaType { get; set; }
    public double SchemaPrice { get; set; }
    public List<ItemBankProductRow> Products { get; set; } = new();
    public List<ItemBankIngredientRow> Ingredients { get; set; } = new();
}

sealed class ItemBankProductRow
{
    public long RecipeId { get; set; }
    public string ProductType { get; set; } = "";
    public string ProductName { get; set; } = "";
    public double ProductQuantity { get; set; }
}

sealed class ItemBankIngredientRow
{
    public long RecipeId { get; set; }
    public string IngredientType { get; set; } = "";
    public string IngredientName { get; set; } = "";
    public double IngredientQuantity { get; set; }
}

sealed class ItemBankGroupRow
{
    public string GroupId { get; set; } = "";
    public string Name { get; set; } = "";
}

public sealed partial class MyDuMod
{
    private const string ItemBankDatabaseFileName = "RecipesGroups.sqlite";
    private readonly object itemBankSchemaGate = new();
    private bool itemBankSchemaReady;

    private IReadOnlyList<string> GetItemBankDatabaseCandidatePaths()
    {
        var paths = new List<string>();

        if (!string.IsNullOrWhiteSpace(outputDirectory))
        {
            var serverRoot = Path.GetFullPath(Path.Combine(outputDirectory, "..", ".."));
            paths.Add(Path.Combine(serverRoot, "wincs", "all", "Mods", ItemBankDatabaseFileName));
        }

        return paths
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private string? ResolveExistingItemBankDatabasePath()
    {
        foreach (var path in GetItemBankDatabaseCandidatePaths())
        {
            if (File.Exists(path))
            {
                return path;
            }
        }

        return null;
    }

    private SqliteConnection OpenItemBankConnection()
    {
        var dbPath = ResolveExistingItemBankDatabasePath();
        if (string.IsNullOrWhiteSpace(dbPath))
        {
            throw new ToolboxOpsException("item_bank_not_found",
                new JObject
                {
                    ["candidates"] = new JArray(GetItemBankDatabaseCandidatePaths())
                });
        }

        Directory.CreateDirectory(mcpBridgeStateDirectory);
        var connection = new SqliteConnection("Data Source=" + dbPath);
        connection.Open();
        EnsureItemBankSchema(connection);
        return connection;
    }

    private void EnsureItemBankSchema(SqliteConnection connection)
    {
        if (itemBankSchemaReady) return;

        lock (itemBankSchemaGate)
        {
            if (itemBankSchemaReady) return;

            try
            {
                using var command = connection.CreateCommand();
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS item_groups (
                        group_id  TEXT PRIMARY KEY,
                        name      TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS items (
                        nq_id            INTEGER PRIMARY KEY,
                        name             TEXT NOT NULL,
                        recipe_id        INTEGER NOT NULL,
                        group_id         TEXT    NOT NULL,
                        level            INTEGER NOT NULL,
                        size             TEXT,
                        industry         TEXT,
                        unit_mass        REAL,
                        unit_volume      REAL,
                        nanocraftable    INTEGER NOT NULL DEFAULT 0,
                        json_key         TEXT NOT NULL,
                        schema_type      TEXT,
                        schema_price     REAL
                    );
                    CREATE TABLE IF NOT EXISTS recipe_products (
                        recipe_id        INTEGER NOT NULL,
                        product_type     TEXT    NOT NULL,
                        product_name     TEXT    NOT NULL,
                        product_quantity REAL    NOT NULL,
                        PRIMARY KEY (recipe_id, product_type)
                    );
                    CREATE TABLE IF NOT EXISTS recipe_ingredients (
                        recipe_id          INTEGER NOT NULL,
                        ingredient_type    TEXT    NOT NULL,
                        ingredient_name    TEXT    NOT NULL,
                        ingredient_quantity REAL   NOT NULL,
                        PRIMARY KEY (recipe_id, ingredient_type)
                    );
                    CREATE INDEX IF NOT EXISTS idx_ib_items_name       ON items(name);
                    CREATE INDEX IF NOT EXISTS idx_ib_items_nq_id      ON items(nq_id);
                    CREATE INDEX IF NOT EXISTS idx_ib_items_recipe_id   ON items(recipe_id);
                    CREATE INDEX IF NOT EXISTS idx_ib_items_group_id    ON items(group_id);
                    CREATE INDEX IF NOT EXISTS idx_ib_items_level       ON items(level);
                    CREATE INDEX IF NOT EXISTS idx_ib_items_industry   ON items(industry);
                    CREATE INDEX IF NOT EXISTS idx_ib_items_name_level  ON items(name, level);
                    CREATE INDEX IF NOT EXISTS idx_ib_items_group_level ON items(group_id, level);
                    CREATE INDEX IF NOT EXISTS idx_ib_groups_name      ON item_groups(name);
                    CREATE INDEX IF NOT EXISTS idx_ib_products_type    ON recipe_products(product_type);
                    CREATE INDEX IF NOT EXISTS idx_ib_products_name    ON recipe_products(product_name);
                    CREATE INDEX IF NOT EXISTS idx_ib_ingredients_type ON recipe_ingredients(ingredient_type);
                    CREATE INDEX IF NOT EXISTS idx_ib_ingredients_name ON recipe_ingredients(ingredient_name);
                ";
                command.ExecuteNonQuery();
                itemBankSchemaReady = true;
                logger.LogInformation("UIToolbox ensured item bank schema");
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "UIToolbox failed to ensure item bank schema");
            }
        }
    }

    private JObject BuildQueryItemBankPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var args = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();

        var groupName = args["groupName"]?.Value<string>()?.Trim();
        var itemName = args["itemName"]?.Value<string>()?.Trim();
        var itemNameContains = args["itemNameContains"]?.Value<string>()?.Trim();
        var level = ReadInt32Token(args["level"]);
        var nqId = ReadInt64Token(args["nqId"]);
        var industry = args["industry"]?.Value<string>()?.Trim();
        var includeProducts = args["includeProducts"]?.Value<bool>() ?? false;
        var includeIngredients = args["includeIngredients"]?.Value<bool>() ?? false;
        var limit = ReadInt32Token(args["limit"]) ?? 100;

        if (limit <= 0) limit = 100;
        if (limit > 1000) limit = 1000;

        if (!TryOpenItemBankConnection(out var connection))
        {
            return CreateToolboxOpsFailure(commandId, "query_item_bank", "item_bank_not_available");
        }

        try
        {
            var conditions = new List<string>();
            var cmd = connection.CreateCommand();

            if (!string.IsNullOrEmpty(groupName))
            {
                conditions.Add("ig.name = $groupName");
                cmd.Parameters.AddWithValue("$groupName", groupName);
            }
            if (!string.IsNullOrEmpty(itemName))
            {
                conditions.Add("i.name = $itemName");
                cmd.Parameters.AddWithValue("$itemName", itemName);
            }
            if (!string.IsNullOrEmpty(itemNameContains))
            {
                conditions.Add("i.name LIKE $itemNameContains");
                cmd.Parameters.AddWithValue("$itemNameContains", "%" + itemNameContains + "%");
            }
            if (level.HasValue)
            {
                conditions.Add("i.level = $level");
                cmd.Parameters.AddWithValue("$level", level.Value);
            }
            if (nqId.HasValue)
            {
                conditions.Add("i.nq_id = $nqId");
                cmd.Parameters.AddWithValue("$nqId", nqId.Value);
            }
            if (!string.IsNullOrEmpty(industry))
            {
                conditions.Add("i.industry = $industry");
                cmd.Parameters.AddWithValue("$industry", industry);
            }

            var whereClause = conditions.Count > 0
                ? "WHERE " + string.Join(" AND ", conditions)
                : "";

            cmd.CommandText = $@"
                SELECT i.nq_id, i.name, i.recipe_id, i.group_id, ig.name,
                       i.level, i.size, i.industry, i.unit_mass, i.unit_volume,
                       i.nanocraftable, i.json_key, i.schema_type, i.schema_price
                FROM items i
                JOIN item_groups ig ON i.group_id = ig.group_id
                {whereClause}
                ORDER BY i.level, i.name
                LIMIT $limit";
            cmd.Parameters.AddWithValue("$limit", limit);

            var items = new List<ItemBankItemRow>();
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    var row = new ItemBankItemRow
                    {
                        NqId = reader.GetInt64(0),
                        Name = reader.GetString(1),
                        RecipeId = reader.GetInt64(2),
                        GroupId = reader.GetString(3),
                        GroupName = reader.GetString(4),
                        Level = reader.GetInt32(5),
                        Size = reader.IsDBNull(6) ? null : reader.GetString(6),
                        Industry = reader.IsDBNull(7) ? null : reader.GetString(7),
                        UnitMass = reader.IsDBNull(8) ? 0.0 : reader.GetDouble(8),
                        UnitVolume = reader.IsDBNull(9) ? 0.0 : reader.GetDouble(9),
                        Nanocraftable = !reader.IsDBNull(10) && reader.GetInt32(10) != 0,
                        JsonKey = reader.GetString(11),
                        SchemaType = reader.IsDBNull(12) ? null : reader.GetString(12),
                        SchemaPrice = reader.IsDBNull(13) ? 0.0 : reader.GetDouble(13)
                    };
                    items.Add(row);
                }
            }
            cmd.Dispose();

            // Fetch products and ingredients if requested
            if ((includeProducts || includeIngredients) && items.Count > 0)
            {
                var recipeIds = items.Select(i => i.RecipeId).Distinct().ToList();
                var idParams = new List<string>();
                var paramIndex = 0;
                foreach (var rid in recipeIds)
                {
                    var paramName = $"$rid{paramIndex}";
                    idParams.Add(paramName);
                    paramIndex++;
                }

                var recipeIdSet = string.Join(", ", idParams);

                if (includeProducts)
                {
                    using var prodCmd = connection.CreateCommand();
                    prodCmd.CommandText = $@"
                        SELECT recipe_id, product_type, product_name, product_quantity
                        FROM recipe_products
                        WHERE recipe_id IN ({recipeIdSet})";
                    var pi = 0;
                    foreach (var rid in recipeIds)
                    {
                        prodCmd.Parameters.AddWithValue($"$rid{pi}", rid);
                        pi++;
                    }

                    using var prodReader = prodCmd.ExecuteReader();
                    var productsByRecipe = new Dictionary<long, List<ItemBankProductRow>>();
                    while (prodReader.Read())
                    {
                        var prod = new ItemBankProductRow
                        {
                            RecipeId = prodReader.GetInt64(0),
                            ProductType = prodReader.GetString(1),
                            ProductName = prodReader.GetString(2),
                            ProductQuantity = prodReader.GetDouble(3)
                        };
                        if (!productsByRecipe.TryGetValue(prod.RecipeId, out var list))
                        {
                            list = new List<ItemBankProductRow>();
                            productsByRecipe[prod.RecipeId] = list;
                        }
                        list.Add(prod);
                    }

                    foreach (var item in items)
                    {
                        if (productsByRecipe.TryGetValue(item.RecipeId, out var prods))
                        {
                            item.Products = prods;
                        }
                    }
                }

                if (includeIngredients)
                {
                    using var ingCmd = connection.CreateCommand();
                    ingCmd.CommandText = $@"
                        SELECT recipe_id, ingredient_type, ingredient_name, ingredient_quantity
                        FROM recipe_ingredients
                        WHERE recipe_id IN ({recipeIdSet})";
                    var pi2 = 0;
                    foreach (var rid in recipeIds)
                    {
                        ingCmd.Parameters.AddWithValue($"$rid{pi2}", rid);
                        pi2++;
                    }

                    using var ingReader = ingCmd.ExecuteReader();
                    var ingredientsByRecipe = new Dictionary<long, List<ItemBankIngredientRow>>();
                    while (ingReader.Read())
                    {
                        var ing = new ItemBankIngredientRow
                        {
                            RecipeId = ingReader.GetInt64(0),
                            IngredientType = ingReader.GetString(1),
                            IngredientName = ingReader.GetString(2),
                            IngredientQuantity = ingReader.GetDouble(3)
                        };
                        if (!ingredientsByRecipe.TryGetValue(ing.RecipeId, out var list))
                        {
                            list = new List<ItemBankIngredientRow>();
                            ingredientsByRecipe[ing.RecipeId] = list;
                        }
                        list.Add(ing);
                    }

                    foreach (var item in items)
                    {
                        if (ingredientsByRecipe.TryGetValue(item.RecipeId, out var ings))
                        {
                            item.Ingredients = ings;
                        }
                    }
                }
            }

            var resultsArray = new JArray();
            foreach (var item in items)
            {
                var obj = new JObject
                {
                    ["nqId"] = item.NqId,
                    ["name"] = item.Name,
                    ["recipeId"] = item.RecipeId,
                    ["groupId"] = item.GroupId,
                    ["groupName"] = item.GroupName,
                    ["level"] = item.Level,
                    ["unitMass"] = item.UnitMass,
                    ["unitVolume"] = item.UnitVolume,
                    ["nanocraftable"] = item.Nanocraftable,
                    ["jsonKey"] = item.JsonKey,
                    ["schemaPrice"] = item.SchemaPrice
                };
                obj["size"] = item.Size != null ? (JValue)item.Size : JValue.CreateNull();
                obj["industry"] = item.Industry != null ? (JValue)item.Industry : JValue.CreateNull();
                obj["schemaType"] = item.SchemaType != null ? (JValue)item.SchemaType : JValue.CreateNull();

                if (includeProducts && item.Products.Count > 0)
                {
                    var prods = new JArray();
                    foreach (var p in item.Products)
                    {
                        prods.Add(new JObject
                        {
                            ["productType"] = p.ProductType,
                            ["productName"] = p.ProductName,
                            ["productQuantity"] = p.ProductQuantity
                        });
                    }
                    obj["products"] = prods;
                }

                if (includeIngredients && item.Ingredients.Count > 0)
                {
                    var ings = new JArray();
                    foreach (var i in item.Ingredients)
                    {
                        ings.Add(new JObject
                        {
                            ["ingredientType"] = i.IngredientType,
                            ["ingredientName"] = i.IngredientName,
                            ["ingredientQuantity"] = i.IngredientQuantity
                        });
                    }
                    obj["ingredients"] = ings;
                }

                resultsArray.Add(obj);
            }

            return new JObject
            {
                ["commandId"] = commandId,
                ["success"] = true,
                ["error"] = JValue.CreateNull(),
                ["method"] = "query_item_bank",
                ["count"] = resultsArray.Count,
                ["results"] = resultsArray
            };
        }
        finally
        {
            connection.Close();
            connection.Dispose();
        }
    }

    private JObject BuildListItemBankGroupsPayload(string commandId, ulong requesterPlayerId, JObject payload)
    {
        var args = ReadProbeArgObject(payload["probeArgs"] as JArray, 0) ?? new JObject();

        var groupName = args["groupName"]?.Value<string>()?.Trim();
        var limit = ReadInt32Token(args["limit"]) ?? 500;

        if (limit <= 0) limit = 500;
        if (limit > 2000) limit = 2000;

        if (!TryOpenItemBankConnection(out var connection))
        {
            return CreateToolboxOpsFailure(commandId, "list_item_bank_groups", "item_bank_not_available");
        }

        try
        {
            var groups = new List<ItemBankGroupRow>();

            using var cmd = connection.CreateCommand();
            if (!string.IsNullOrEmpty(groupName))
            {
                cmd.CommandText = @"
                    SELECT group_id, name
                    FROM item_groups
                    WHERE name LIKE $groupName
                    ORDER BY name
                    LIMIT $limit";
                cmd.Parameters.AddWithValue("$groupName", "%" + groupName + "%");
            }
            else
            {
                cmd.CommandText = @"
                    SELECT group_id, name
                    FROM item_groups
                    ORDER BY name
                    LIMIT $limit";
            }
            cmd.Parameters.AddWithValue("$limit", limit);

            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    groups.Add(new ItemBankGroupRow
                    {
                        GroupId = reader.GetString(0),
                        Name = reader.GetString(1)
                    });
                }
            }

            var resultsArray = new JArray();
            foreach (var g in groups)
            {
                resultsArray.Add(new JObject
                {
                    ["groupId"] = g.GroupId,
                    ["name"] = g.Name
                });
            }

            return new JObject
            {
                ["commandId"] = commandId,
                ["success"] = true,
                ["error"] = JValue.CreateNull(),
                ["method"] = "list_item_bank_groups",
                ["count"] = resultsArray.Count,
                ["results"] = resultsArray
            };
        }
        finally
        {
            connection.Close();
            connection.Dispose();
        }
    }

    private bool TryOpenItemBankConnection(out SqliteConnection connection)
    {
        connection = null!;
        try
        {
            if (string.IsNullOrWhiteSpace(ResolveExistingItemBankDatabasePath()))
            {
                return false;
            }

            connection = OpenItemBankConnection();
            return true;
        }
        catch
        {
            connection = null;
            return false;
        }
    }

    /// <summary>
    /// Tries to resolve a display name (e.g. "Pure Aluminium") to the game-internal
    /// item type ID and name through the item bank SQLite database.
    /// Returns null if not found or if the database is unavailable.
    /// The returned nqId can be cast to ulong for IGameplayBank lookups.
    /// </summary>
    internal (long NqId, string JsonKey)? TryResolveItemNameThroughItemBank(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            return null;
        }

        if (!TryOpenItemBankConnection(out var connection))
        {
            return null;
        }

        try
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT nq_id, json_key FROM items WHERE name = @name LIMIT 1";
            cmd.Parameters.AddWithValue("@name", displayName.Trim());

            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                var nqId = reader.GetInt64(0);
                var jsonKey = reader.GetString(1);
                return (nqId, jsonKey);
            }

            // No exact match on name; try json_key as fallback
            // (json_key is the game-internal name like "AluminiumPure")
            cmd.Parameters.Clear();
            cmd.CommandText = "SELECT nq_id, json_key FROM items WHERE json_key = @jsonKey LIMIT 1";
            cmd.Parameters.AddWithValue("@jsonKey", displayName.Trim());
            using var reader2 = cmd.ExecuteReader();
            if (reader2.Read())
            {
                var nqId = reader2.GetInt64(0);
                var jsonKey = reader2.GetString(1);
                return (nqId, jsonKey);
            }

            return null;
        }
        finally
        {
            connection.Close();
            connection.Dispose();
        }
    }

    internal EmbeddedIndustryRecipeCatalog LoadIndustryRecipeCatalogFromItemBank()
    {
        if (!TryOpenItemBankConnection(out var connection))
        {
            throw new InvalidOperationException("item_bank_not_found");
        }

        try
        {
            var byRecipeKey = new Dictionary<string, EmbeddedIndustryRecipeReference>(StringComparer.OrdinalIgnoreCase);
            var byRecipeId = new Dictionary<ulong, EmbeddedIndustryRecipeReference>();
            var byProductItemTypeId = new Dictionary<ulong, EmbeddedIndustryRecipeReference>();
            var productNamesByRecipeId = new Dictionary<long, List<(string Name, string Type)>>();
            var ingredientNamesByRecipeId = new Dictionary<long, List<string>>();

            using (var productsCmd = connection.CreateCommand())
            {
                productsCmd.CommandText = @"
                    SELECT recipe_id, product_name, product_type
                    FROM recipe_products";
                using var reader = productsCmd.ExecuteReader();
                while (reader.Read())
                {
                    var recipeId = reader.GetInt64(0);
                    var productName = reader.IsDBNull(1) ? string.Empty : reader.GetString(1).Trim();
                    var productType = reader.IsDBNull(2) ? string.Empty : reader.GetString(2).Trim();
                    if (!productNamesByRecipeId.TryGetValue(recipeId, out var list))
                    {
                        list = new List<(string Name, string Type)>();
                        productNamesByRecipeId[recipeId] = list;
                    }

                    if (!string.IsNullOrWhiteSpace(productName))
                    {
                        list.Add((productName, productType));
                    }
                }
            }

            using (var ingredientsCmd = connection.CreateCommand())
            {
                ingredientsCmd.CommandText = @"
                    SELECT recipe_id, ingredient_name
                    FROM recipe_ingredients";
                using var reader = ingredientsCmd.ExecuteReader();
                while (reader.Read())
                {
                    var recipeId = reader.GetInt64(0);
                    var ingredientName = reader.IsDBNull(1) ? string.Empty : reader.GetString(1).Trim();
                    if (string.IsNullOrWhiteSpace(ingredientName))
                    {
                        continue;
                    }

                    if (!ingredientNamesByRecipeId.TryGetValue(recipeId, out var list))
                    {
                        list = new List<string>();
                        ingredientNamesByRecipeId[recipeId] = list;
                    }

                    list.Add(ingredientName);
                }
            }

            using (var itemsCmd = connection.CreateCommand())
            {
                itemsCmd.CommandText = @"
                    SELECT i.nq_id, i.name, i.recipe_id, i.json_key, i.industry, ig.name
                    FROM items i
                    JOIN item_groups ig ON i.group_id = ig.group_id";

                using var reader = itemsCmd.ExecuteReader();
                while (reader.Read())
                {
                    var productItemTypeId = reader.GetInt64(0);
                    var fallbackItemName = reader.IsDBNull(1) ? string.Empty : reader.GetString(1).Trim();
                    var recipeId = reader.GetInt64(2);
                    var recipeKey = reader.IsDBNull(3) ? string.Empty : reader.GetString(3).Trim();
                    var industryName = reader.IsDBNull(4) ? string.Empty : reader.GetString(4).Trim();
                    var parentGroupName = reader.IsDBNull(5) ? string.Empty : reader.GetString(5).Trim();

                    if (string.IsNullOrWhiteSpace(recipeKey))
                    {
                        continue;
                    }

                    productNamesByRecipeId.TryGetValue(recipeId, out var productRows);
                    ingredientNamesByRecipeId.TryGetValue(recipeId, out var ingredientRows);

                    var distinctProductRows = (productRows ?? new List<(string Name, string Type)>())
                        .Where(entry => !string.IsNullOrWhiteSpace(entry.Name))
                        .Distinct()
                        .ToList();
                    var productNames = distinctProductRows
                        .Select(entry => entry.Name)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                    if (productNames.Count == 0 && !string.IsNullOrWhiteSpace(fallbackItemName))
                    {
                        productNames.Add(fallbackItemName);
                    }

                    var ingredientNames = (ingredientRows ?? new List<string>())
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();

                    var reference = new EmbeddedIndustryRecipeReference
                    {
                        RecipeKey = recipeKey,
                        RecipeId = recipeId > 0 ? (ulong)recipeId : 0,
                        ProductItemTypeId = productItemTypeId > 0 ? (ulong)productItemTypeId : 0,
                        ProductTypeKey = distinctProductRows.FirstOrDefault().Type ?? recipeKey,
                        ProductItemName = productNames.FirstOrDefault() ?? fallbackItemName,
                        IndustryName = industryName,
                        ParentGroupName = parentGroupName,
                        ProductNames = productNames,
                        IngredientNames = ingredientNames
                    };

                    byRecipeKey[reference.RecipeKey] = reference;
                    if (reference.RecipeId > 0 && !byRecipeId.ContainsKey(reference.RecipeId))
                    {
                        byRecipeId[reference.RecipeId] = reference;
                    }

                    if (reference.ProductItemTypeId > 0 && !byProductItemTypeId.ContainsKey(reference.ProductItemTypeId))
                    {
                        byProductItemTypeId[reference.ProductItemTypeId] = reference;
                    }
                }
            }

            var byProductName = byRecipeKey.Values
                .SelectMany(reference => reference.ProductNames.Select(name => (name, reference)))
                .GroupBy(pair => pair.name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyList<EmbeddedIndustryRecipeReference>)group
                        .Select(pair => pair.reference)
                        .Distinct()
                        .OrderBy(reference => reference.RecipeId)
                        .ToList(),
                    StringComparer.OrdinalIgnoreCase);

            var byIngredientName = byRecipeKey.Values
                .SelectMany(reference => reference.IngredientNames.Select(name => (name, reference)))
                .GroupBy(pair => pair.name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyList<EmbeddedIndustryRecipeReference>)group
                        .Select(pair => pair.reference)
                        .Distinct()
                        .OrderBy(reference => reference.RecipeId)
                        .ToList(),
                    StringComparer.OrdinalIgnoreCase);

            logger.LogInformation(
                "UIToolbox loaded industry recipe catalog from item bank entries={EntryCount}, recipeIds={RecipeIdCount}, productItemTypeIds={ProductItemTypeIdCount}",
                byRecipeKey.Count,
                byRecipeId.Count,
                byProductItemTypeId.Count);

            return new EmbeddedIndustryRecipeCatalog
            {
                ByRecipeKey = byRecipeKey,
                ByRecipeId = byRecipeId,
                ByProductItemTypeId = byProductItemTypeId,
                ByProductName = byProductName,
                ByIngredientName = byIngredientName
            };
        }
        finally
        {
            connection.Close();
            connection.Dispose();
        }
    }

}
