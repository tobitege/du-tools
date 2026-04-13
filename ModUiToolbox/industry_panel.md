The `Configuration` tab is the game’s `recipeSubPanel`.

Evidence from the live dump:
- [ui-1775971309011-59465098.ndjson line 6](/d:/MyDUserver/tmp/ui-dumps/ui-1775971309011-59465098.ndjson) contains the wrapper `id="industryPanel_recipeSubPanel_wrapper"`.
- The same dump section contains:
  - `industryPanel_recipeSubPanel_onlyAvailableCheckbox`
  - `industryPanel_recipeSubPanel_onlyDoableCheckbox`
  - `industryPanel_recipeSubPanel_drilldownArea`
- Inside that drilldown area, the live tree starts with `Materials`, then `Fuels`, `Refined Materials`, `Product`, and so on.

That means the tab is not using the production subpanel at all. It is the recipes/configuration subpanel, and its tree is rendered into `industryPanel_recipeSubPanel_drilldownArea`.

So the flow is:

1. Native game data is exposed to the live industry panel through `CPPIndustryPanel`.
2. `industry_panel.js` owns the overall panel.
3. `industry_panel_recipes.js` owns the `Configuration` tab.
4. That recipes subpanel builds the `Materials` tree inside `industryPanel_recipeSubPanel_drilldownArea` using the common `drilldown.js` widget.
5. The two checkboxes then filter that machine-specific recipe set:
   - `onlyAvailable`
   - `onlyDoable`

I added the path to do it:

- `payload/ModUiToolbox-payload.js` now supports `mode: "single_script"` and emits the fetched body as a real `.js` dump section.
- [ModUIToolbox.cs](/d:/github/du-tobi/ModUiToolbox/ModUIToolbox.cs) now lets `ui_dump` accept `mode: "single_script"` and `mode: "all_scripts"`.
- The extractor override is already published, and `dotnet build -c Release` succeeded.


What this script shows:

- The `Configuration` tab is `class ChangeRecipeSubPanel`.
- It owns:
  - `industryPanel_recipeSubPanel_onlyAvailableCheckbox`
  - `industryPanel_recipeSubPanel_onlyDoableCheckbox`
  - `industryPanel_recipeSubPanel_drilldownArea`
- The tree is built in `setRecipeList(productList, industryType)`.
  - For normal industry units, it does:
    - `let productListSet = new Set(productList);`
    - `hierachy = itemBank.searchHierachy(item => productListSet.has(item.typeId), itemBank.getHierarchyTree());`
    - `this.itemTreeComponent.setItemHierachy(hierachy);`
- So `Materials` and the rest come from:
  - a `productList` passed into this subpanel
  - intersected with the global `itemBank` hierarchy tree

The filtering logic is also explicit:

- `_testRecipesAvailable()` loops `this.itemTreeComponent.allNodesSet`
- for each item type it gets recipes via `this.parentPanel._getRecipesFromTypeId(itemTypeId)`
- it marks an item as doable if any modified recipe passes `this.parentPanel._testCanDoRecipe(modifiedRecipe)`
- `_search()` then applies:
  - text search
  - `onlyDoableCheckbox`
  - `onlyAvailableCheckbox`, where availability means:
    - no schematic required, or
    - `this.parentPanel.getSchematicCountMatchingItem(item.typeId, true, true) > 0`

So the remaining missing piece is upstream:
- where `productList` comes from
- how `parentPanel._getRecipesFromTypeId(...)` is filled

That will be in `industry_panel.js`, not this file. If you want, I can pull that next and trace the full chain from machine type to `productList` and recipe map.

The exact chain is:

1. The game opens the panel with `industryUnitInformationsJSON`.
2. `IndustryPanel.show(...)` parses that JSON and reads:
   - `industryInfo.industryUnitTypeId`
   - `industryInfo.productList`
   - `industryInfo.isTransferUnit`
3. It sets the machine definition from `industryUnitTypeId`, but the recipe tree itself comes from `productList`, not from `unitItemDefinition`.
4. It passes that list into the Configuration tab:
   - `this.changeRecipeSubPanel.setRecipeList(industryInfo.productList, this.industryUnitType);`

For tooling, `industryInfo.isTransferUnit` is the important discriminator.
Transfer units are one shared machine type with many concrete instances, so the type itself can be treated deterministically while instance selection can still use explicit ids, links, or intentional player-assigned names.
On the live panel, the semantic mode label is `Move`, but under the hood it is still the same production enum path as `MAKE_BATCHS`.
For higher-level commands, a user-provided bare `ID` should be interpreted as the construct-local `localId` unless they explicitly say `elementId` or another global id kind.

You can see that in:
- [all_script_js_000_industry_panel.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js)
- relevant hits:
  - `show(...)` at line `414`
  - `unitItemDefinition = itemBank.getItemDefinition(industryInfo.industryUnitTypeId);` at line `422`
  - `changeRecipeSubPanel.setRecipeList(industryInfo.productList, this.industryUnitType);` at line `423`

Then the Configuration tab builds the visible `Materials` tree like this:

- In [all_script_js_000_industry_panel_recipes.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974543576-700656476/ui-1775974543576-700656476/scripts/all_script_js_000_industry_panel_recipes.js), `setRecipeList(productList, industryType)` does:
  - `let productListSet = new Set(productList);`
  - `hierachy = itemBank.searchHierachy(item => productListSet.has(item.typeId), itemBank.getHierarchyTree());`
  - `this.itemTreeComponent.setItemHierachy(hierachy);`

So:

`industryUnitInformationsJSON.productList -> itemBank.searchHierachy(...) -> drilldown tree -> Materials / Parts / ...`

When you click a leaf item, it gets the actual recipes for that item type here:

- `IndustryPanel._getRecipesFromTypeId(typeId)` in [all_script_js_000_industry_panel.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js)
- for classic industry units it does:
  - `let recipeList = recipeBank.getRecipesByTypeId(typeId);`
  - then wraps each one through `_modifyRecipeByIndustry(recipe)`

So the full flow is:

`CPP/native panel data -> industryUnitInformationsJSON.productList -> itemBank hierarchy for tree`
`clicked typeId -> recipeBank.getRecipesByTypeId(typeId) -> _modifyRecipeByIndustry(...) -> recipe dropdown/details`

Filtering is separate:
- `Show doable productions only` uses `_testRecipesAvailable()` plus `_testCanDoRecipe(...)`
- `Show available productions only` checks schematics with `getSchematicCountMatchingItem(...)`

Most important correction to the earlier assumption:
- `unitItemDefinition` identifies the machine
- `productList` is what actually determines which recipe categories/items appear in Configuration

There is no single “give me all recipes for this industry kind” call.

The exact sequence is:

1. Native side opens the panel and passes `industryUnitInformationsJSON` into `IndustryPanel.show(...)`.
2. `IndustryPanel.show(...)` parses that JSON and reads `industryInfo.productList`.
3. `IndustryPanel.show(...)` calls `this.changeRecipeSubPanel.setRecipeList(industryInfo.productList, this.industryUnitType)`.
4. `ChangeRecipeSubPanel.setRecipeList(...)` builds the tree for the machine kind:
   - for classic industry: `new Set(productList)`
   - then `itemBank.searchHierachy(item => productListSet.has(item.typeId), itemBank.getHierarchyTree())`
   - then `this.itemTreeComponent.setItemHierachy(hierachy)`

That is the list of all producible item types for that industry kind, grouped into `Materials`, `Parts`, and so on.

Files:
- [all_script_js_000_industry_panel.js line 410](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js)
- [all_script_js_000_industry_panel_recipes.js line 228](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974543576-700656476/ui-1775974543576-700656476/scripts/all_script_js_000_industry_panel_recipes.js)

If you mean the concrete recipe variants for one selected product type, the sequence is:

1. Click a leaf item in the tree.
2. `ChangeRecipeSubPanel.updateSelectedItem(typeId)`
3. `this.parentPanel._getRecipesFromTypeId(typeId)`
4. In `IndustryPanel._getRecipesFromTypeId(typeId)` for classic industry:
   - `recipeBank.getRecipesByTypeId(typeId)`
   - each recipe is passed through `this._modifyRecipeByIndustry(recipe)`

Files:
- [all_script_js_000_industry_panel_recipes.js line 202](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974543576-700656476/ui-1775974543576-700656476/scripts/all_script_js_000_industry_panel_recipes.js)
- [all_script_js_000_industry_panel.js line 122](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js)

So the key point is:

- machine kind -> `industryInfo.productList` gives the allowed product type IDs
- selected product type -> `recipeBank.getRecipesByTypeId(typeId)` gives the actual recipes

The exact UI call chain is:

1. Panel opens.
   - `IndustryPanel.show(isVisible, industryUnitInformationsJSON)` parses the native JSON.
   - It calls `this.changeRecipeSubPanel.setRecipeList(industryInfo.productList, this.industryUnitType);`
   - File: [all_script_js_000_industry_panel.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js)

2. Configuration tree is built.
   - `ChangeRecipeSubPanel.setRecipeList(productList, industryType)`
   - For classic industry it turns `productList` into a hierarchy with:
     - `itemBank.searchHierachy(item => productListSet.has(item.typeId), itemBank.getHierarchyTree())`
   - That is what creates the `Materials` / `Parts` tree.
   - File: [all_script_js_000_industry_panel_recipes.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974543576-700656476/ui-1775974543576-700656476/scripts/all_script_js_000_industry_panel_recipes.js)

3. User clicks a leaf item.
   - In the constructor:
     - `this.itemTreeComponent.events.onClickLeaf.subscribe(leafKey => this.updateSelectedItem(leafKey));`
   - So clicking a product type calls `updateSelectedItem(typeId)`.
   - File: [all_script_js_000_industry_panel_recipes.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974543576-700656476/ui-1775974543576-700656476/scripts/all_script_js_000_industry_panel_recipes.js)

4. That is where `getRecipesByTypeId` gets reached.
   - `updateSelectedItem(typeId)` calls:
     - `let recipesListObj = this.parentPanel._getRecipesFromTypeId(typeId);`
   - Then `IndustryPanel._getRecipesFromTypeId(typeId)` does:
     - `let recipeList = recipeBank.getRecipesByTypeId(typeId);`
     - wraps each through `_modifyRecipeByIndustry(recipe)`
     - returns the object keyed by recipe id.
   - Files:
     - [all_script_js_000_industry_panel_recipes.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974543576-700656476/ui-1775974543576-700656476/scripts/all_script_js_000_industry_panel_recipes.js)
     - [all_script_js_000_industry_panel.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js)

5. The returned recipes are pushed into the UI immediately.
   - `updateSelectedItem(typeId)` loops the returned recipes and does:
     - `this.recipesDropdown.addListElement(recipeId, label);`
   - Then:
     - `this.setCurrentChangeRecipe(defaultSelectedRecipeKey);`
   - `setCurrentChangeRecipe(recipeId)` calls:
     - `this.currentChangeRecipe = this.parentPanel._getRecipeFromRecipeId(recipeId);`
     - `this._updateSelectedRecipeInformation(this.currentChangeRecipe);`
   - `_updateSelectedRecipeInformation(...)` fills:
     - ingredients list
     - products list
     - produced quantity/volume/mass
     - processing time

So the short answer is:

`native panel JSON -> setRecipeList(productList) -> user clicks tree leaf -> updateSelectedItem(typeId) -> _getRecipesFromTypeId(typeId) -> recipeBank.getRecipesByTypeId(typeId) -> dropdown/details UI`

The border is here:

1. Native game client -> JS panel
   - `IndustryPanel.show(isVisible, industryUnitInformationsJSON)`
   - `IndustryPanel.updateStatus(jsonNewStatus)`
   - `CPPIndustryPanel.changeRecipe(...)`, `CPPIndustryPanel.close()`, and similar calls
   - File: [all_script_js_000_industry_panel.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js)

That is the boundary where the game client hands data into JS or receives commands back from JS.

After that boundary, it is all JS:

- `show(...)` parses `industryUnitInformationsJSON`
- reads `industryInfo.productList`
- calls `changeRecipeSubPanel.setRecipeList(industryInfo.productList, this.industryUnitType)`
- the Configuration tab builds the tree from that list
- when you click a product type, JS calls `recipeBank.getRecipesByTypeId(typeId)`
- the dropdown/details are filled from that returned JS data

So there are really two data sources:

- Live machine-specific data from the game client:
  - comes in through `industryUnitInformationsJSON` and `jsonNewStatus`
  - this decides which products this machine can make right now
- Recipe definitions from JS-side data:
  - accessed through `recipeBank.getRecipesByTypeId(typeId)`
  - this gives the actual recipe variants/details for a chosen product type

So the direct answer is:

- The client/JS border is not `getRecipesByTypeId`.
- The border is `show(...industryUnitInformationsJSON)`, `updateStatus(jsonNewStatus)`, and `CPPIndustryPanel.*`.
- `getRecipesByTypeId` is already on the JS side.

`industryUnitInformationsJSON` comes from the native game client through the Coherent event bus.

The boundary is here in [industry_panel.js](/d:/MyDUserver/tmp/ui-dumps/reassembled-ui-1775974616647-124182561/ui-1775974616647-124182561/scripts/all_script_js_000_industry_panel.js):

- `engine.on("industryPanel.show", industryPanel.show, industryPanel);`
- `engine.on("industryPanel.updateStatus", industryPanel.updateStatus, industryPanel);`
- `engine.on("industryPanel.updateContainers", industryPanel.updateContainers, industryPanel);`

And the receiving method is:

- `show(isVisible, industryUnitInformationsJSON)`

So the flow is:

1. Native client raises `engine` event `industryPanel.show`
2. It passes `industryUnitInformationsJSON` as the second argument
3. JS parses that JSON in `IndustryPanel.show(...)`
4. JS reads `industryInfo.productList`
5. JS builds the Configuration tree from that list

So if your real question is:

“Which native hook delivers the recipe-capability data for the machine?”

Then the answer is:

- inbound hook: `engine.on("industryPanel.show", ...)`
- payload field carrying the available products: `industryInfo.productList`

`CPPIndustryPanel` is the other direction:
- JS -> native commands like `changeRecipe`, `start`, `softStop`, `hardStop`, `close`

If you want the exact native-side producer beyond that, it is outside the extracted JS. The JS only proves the native event name is `industryPanel.show`.
