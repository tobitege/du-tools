/* global CPPIndustryPanel IndustrySubPanel enumIndustryPanelType DropdownComponent FormatNumber IconsLibrary enumIndustryPanelState SearchBoxComponent itemBank createItemDataNode industrySubPanelId ItemTreeComponent stringToSearchFormat */
/* exported ChangeRecipeSubPanel */

class ChangeRecipeSubPanel extends IndustrySubPanel
{
    constructor(parentPanel)
    {
        super(parentPanel);

        this.HTMLNodes.searchInputArea = document.getElementById("industryPanel_recipeSubPanel_searchInputArea");
        this.HTMLNodes.onlyAvailableCheckboxWrapper = document.getElementById("industryPanel_recipeSubPanel_onlyAvailableCheckboxWrapper");
        this.HTMLNodes.onlyAvailableCheckbox = document.getElementById("industryPanel_recipeSubPanel_onlyAvailableCheckbox");
        this.HTMLNodes.onlyDoableCheckbox = document.getElementById("industryPanel_recipeSubPanel_onlyDoableCheckbox");
        this.HTMLNodes.drilldownArea = document.getElementById("industryPanel_recipeSubPanel_drilldownArea");
        this.HTMLNodes.recipesArea = document.getElementById("industryPanel_recipeSubPanel_recipesArea");
        this.HTMLNodes.recipesDropdownWrapper = document.getElementById("industryPanel_recipeSubPanel_recipesDropdownWrapper");
        this.HTMLNodes.ingredientCount = document.getElementById("industryPanel_recipeSubPanel_ingredientCount");
        this.HTMLNodes.ingredientList = document.getElementById("industryPanel_recipeSubPanel_ingredientList");
        this.HTMLNodes.productsCount = document.getElementById("industryPanel_recipeSubPanel_productsCount");
        this.HTMLNodes.productsList = document.getElementById("industryPanel_recipeSubPanel_productsList");
        this.HTMLNodes.producedQuantity = document.getElementById("industryPanel_recipeSubPanel_producedQuantity");
        this.HTMLNodes.producedVolume = document.getElementById("industryPanel_recipeSubPanel_producedVolume");
        this.HTMLNodes.producedMass = document.getElementById("industryPanel_recipeSubPanel_producedMass");
        this.HTMLNodes.processingTime = document.getElementById("industryPanel_recipeSubPanel_processingTime");
        this.HTMLNodes.customPropertiesList = document.getElementById("industryPanel_recipeSubPanel_customPropertiesList");
        this.HTMLNodes.applyButton = document.getElementById("industryPanel_recipeSubPanel_applyButton");
        this.HTMLNodes.mainProductIcon = document.getElementById("industryPanel_recipeSubPanel_mainProductIcon");
        this.HTMLNodes.mainProductDescription = document.getElementById("industryPanel_recipeSubPanel_mainProductDescription");
        this.HTMLNodes.noChangeRecipeMask = document.getElementById("industryPanel_recipeSubPanel_maskNoChangeRecipe");
        this._initializeChangeRecipeSubPanel();

        this.itemTreeComponent = new ItemTreeComponent();
        this.HTMLNodes.drilldownArea.appendChild(this.itemTreeComponent.wrapperNode);
        this.itemTreeComponent.events.onClickLeaf.subscribe(leafKey => this.updateSelectedItem(leafKey));

        this.doableRecipeSet = new Set();
    }

    get contextInfo()
    {
        return locText("ui_hud_industry_recipes_subtitle");
    }

    _querryWrapperNode()
    {
        return document.getElementById("industryPanel_recipeSubPanel_wrapper");
    }

    _onUpdateContainers()
    {
        super._onUpdateContainers();
        this._testRecipesAvailable();
    }

    _testRecipesAvailable()
    {
        if (!this.isVisible)
            return;

        this.doableRecipeSet.clear();

        for (let itemTypeId of [...this.itemTreeComponent.allNodesSet])
        {
            let recipesListObj = this.parentPanel._getRecipesFromTypeId(itemTypeId);
            let canDoRecipe = false;
            for (let recipeId in recipesListObj)
            {
                let recipe = recipesListObj[recipeId];
                let modifiedRecipe = this.parentPanel._modifyRecipeByIndustry(recipe);

                if (this.parentPanel._testCanDoRecipe(modifiedRecipe))
                {
                    canDoRecipe = true;
                    break;
                }
            }

            if (canDoRecipe)
                this.doableRecipeSet.add(itemTypeId);
        }
        this._search(this._durtySearchModifyExpand);
        this._durtySearchModifyExpand = false;
    }

    _onVisibilityChange()
    {
        super._onVisibilityChange();
        if (this.isVisible)
        {
            this._testRecipesAvailable();
            this.HTMLNodes.onlyAvailableCheckboxWrapper.classList.toggle("hide", this.parentPanel.industryUnitType === enumIndustryPanelType.transfer);
        }
    }

    _applyRecipeChange()
    {
        if (!isDefined(this.currentChangeRecipe) || this.parentPanel.currentState !== enumIndustryPanelState.STOPPED)
            return;

        this.parentPanel.selectSubPanel(industrySubPanelId.production);
        if (typeof CPPIndustryPanel !== "undefined" && typeof CPPIndustryPanel.changeRecipe === "function")
            CPPIndustryPanel.changeRecipe(this.currentChangeRecipe.id);
        else
            console.error("Missing CPP model : CPPIndustryPanel.changeRecipe");
    }

    _initializeChangeRecipeSubPanel()
    {
        let self = this;

        this.HTMLNodes.applyButton.addEventListener("click", () => this._applyRecipeChange());
        this.HTMLNodes.onlyDoableCheckbox.addEventListener("click", () => this._search());
        this.HTMLNodes.onlyAvailableCheckbox.addEventListener("click", () => this._search());
        this.HTMLNodes.onlyAvailableCheckbox.checked = true;

        this.searchBox = new SearchBoxComponent();
        this.HTMLNodes.searchInputArea.appendChild(this.searchBox.wrapperNode);
        this.searchBox.events.onNewSearch.subscribe(() => this._search());

        this.recipesDropdown = new DropdownComponent("Select a recipe");
        this.recipesDropdown.onSelectionChange.subscribe(function()
        {
            let recipeId = self.recipesDropdown.currentSelectedListElement;
            self.setCurrentChangeRecipe(recipeId);
        });
        this.HTMLNodes.recipesDropdownWrapper.appendChild(this.recipesDropdown.wrapperNode);

        this._clearSelectedRecipeInformation();
        this._clearSelectedItemInformation();
    }

    _clearSelectedItemInformation()
    {
        removeAllChildren(this.HTMLNodes.customPropertiesList);
        this.HTMLNodes.mainProductIcon.setAttribute("src", IconsLibrary.getEmptyIcon());
        this.HTMLNodes.mainProductIcon.removeAttribute("data-tooltip");
        this.HTMLNodes.mainProductDescription.innerText = null;
    }

    _clearSelectedRecipeInformation()
    {
        removeAllChildren(this.HTMLNodes.ingredientList);
        removeAllChildren(this.HTMLNodes.productsList);
        this.selectedRecipe = null;
    }

    _updateSelectedRecipeInformation(newSelectedRecipe)
    {
        if (isDefined(newSelectedRecipe) && newSelectedRecipe !== this.selectedRecipe)
        {
            this._clearSelectedRecipeInformation();
            this.selectedRecipe = newSelectedRecipe;

            for (let ingredient of this.selectedRecipe.ingredientsModified)
            {
                let itemLineNode = this.parentPanel._createItemNode(ingredient.typeId, ingredient.quantity);
                this.HTMLNodes.ingredientList.appendChild(itemLineNode);
            }
            this.HTMLNodes.ingredientCount.innerText = this.selectedRecipe.ingredientsModified.length + " " + locText("ui_common_label_items");

            for (let product of this.selectedRecipe.productsModified)
            {
                let itemLineNode = this.parentPanel._createItemNode(product.typeId, product.quantity);
                this.HTMLNodes.productsList.appendChild(itemLineNode);
            }
            this.HTMLNodes.productsCount.innerText = this.selectedRecipe.productsModified.length + " " + locText("ui_common_label_items");

            let mainProductDefinition = itemBank.getItemDefinition(this.selectedRecipe.mainProduct.typeId);

            this.HTMLNodes.producedQuantity.innerHTML = FormatNumber.getQuantityString(mainProductDefinition, this.selectedRecipe.mainProduct.quantity);
            this.HTMLNodes.producedVolume.innerText = FormatNumber.getVolumeInLitreString(mainProductDefinition.volume * this.selectedRecipe.mainProduct.quantity);
            this.HTMLNodes.producedMass.innerText = FormatNumber.getMassString(mainProductDefinition.mass * this.selectedRecipe.mainProduct.quantity);
            this.HTMLNodes.processingTime.innerText = FormatNumber.getDurationString(this.selectedRecipe.durationModified, 3);
        }
        else if (!isDefined(newSelectedRecipe))
        {
            this._clearSelectedRecipeInformation();
        }
        this._updateApplyButton();
    }

    _updateSelectedItemInformation(typeId)
    {
        this._clearSelectedItemInformation();
        this.itemTreeComponent.setSelectedLine([typeId]);
        let mainProductDefinition = itemBank.getItemDefinition(typeId);

        this.HTMLNodes.mainProductIcon.setAttribute("src", IconsLibrary.getIconPath(mainProductDefinition.iconFilename));
        this.HTMLNodes.mainProductIcon.setAttribute("data-tooltip", mainProductDefinition.fullName);
        this.HTMLNodes.mainProductDescription.innerText = mainProductDefinition.description;

        for (let customProperty of mainProductDefinition.customProperties)
        {
            let customPropertyNode = createItemDataNode(customProperty.label, customProperty.value);
            this.HTMLNodes.customPropertiesList.appendChild(customPropertyNode);
        }
    }

    updateSelectedItem(typeId)
    {
        this.recipesDropdown.reset();
        let recipesListObj = this.parentPanel._getRecipesFromTypeId(typeId);

        let count = 1;
        for (let recipeId in recipesListObj)
        {
            let label = locText("ui_common_label_recipe").concat(" ", count);

            this.recipesDropdown.addListElement(recipeId, label);
            ++count;
        }

        let hasMultipleRecipes = (Object.keys(recipesListObj).length > 1);
        let defaultSelectedRecipeKey = hasMultipleRecipes ? null : Object.keys(recipesListObj)[0];
        this.HTMLNodes.recipesArea.classList.toggle("hide", !hasMultipleRecipes);

        this._updateSelectedItemInformation(typeId);
        this.setCurrentChangeRecipe(defaultSelectedRecipeKey);
    }

    setCurrentChangeRecipe(recipeId)
    {
        this.currentChangeRecipe = this.parentPanel._getRecipeFromRecipeId(recipeId);
        this._updateSelectedRecipeInformation(this.currentChangeRecipe);
        this.HTMLNodes.noChangeRecipeMask.classList.toggle("hide", isDefined(this.currentChangeRecipe));
    }

    setRecipeList(productList, industryType)
    {
        let hierachy;
        if (industryType === enumIndustryPanelType.transfer)
        {
            hierachy = new Map();

            for (let category of productList)
            {
                hierachy.set(category, itemBank.getHierarchyTreeById(category));
            }
        }
        else
        {
            let productListSet = new Set(productList);
            hierachy = itemBank.searchHierachy(item => productListSet.has(item.typeId), itemBank.getHierarchyTree());
        }

        this.itemTreeComponent.setItemHierachy(hierachy);
        this._search();
    }

    setCurrentSearch(searchValue)
    {
        let newSearch = searchValue;
        if (!isDefined(newSearch))
            newSearch = "";
        this.searchBox.setCurrentSearchString(newSearch);
        this._search();
    }

    _search(modifyDrilldownExpand = true)
    {
        if (!this.isVisible)
        {
            this._durtySearchModifyExpand = this._durtySearchModifyExpand || modifyDrilldownExpand;
            return;
        }

        let searchValue = stringToSearchFormat(this.searchBox.getCurrentSearchString());
        this.parentPanel.mapPreviousSearchByIndustryInstanceId.set(this.parentPanel.industryInstanceId, searchValue);
        let showOnlyDoable = this.HTMLNodes.onlyDoableCheckbox.checked;
        let showOnlyAvailable = this.HTMLNodes.onlyAvailableCheckbox.checked;
        if (searchValue.length >= 1 || showOnlyDoable || showOnlyAvailable)
        {
            let searchFunction = function(item)
            {
                if (!isEmptyString(searchValue) && item.searchName.indexOf(searchValue) < 0)
                    return false;
                if (showOnlyDoable && !this.doableRecipeSet.has(item.typeId))
                    return false;
                if (showOnlyAvailable && this.parentPanel.industryUnitType !== enumIndustryPanelType.transfer)
                {
                    let requiresSchematic = itemBank.getItemDefinition(item.typeId).requiresSchematic;
                    let isAvailable = !requiresSchematic || this.parentPanel.getSchematicCountMatchingItem(item.typeId, true, true) > 0;
                    if (!isAvailable)
                        return false;
                }
                return true;
            }.bind(this);

            this.itemTreeComponent.filterTree(searchFunction);

            if (modifyDrilldownExpand)
                this.itemTreeComponent.expandsAllTreeNodes(itemBank.itemHierarchyToArray(this.itemTreeComponent.filteredHierachy).length < 200);
        }
        else
        {
            this.itemTreeComponent.filterTree(null);
            if (modifyDrilldownExpand)
                this._openLoneDrilldownLevel();
        }
    }

    // Close the drilldown and open levels untils the opened node got more than 1 categories
    _openLoneDrilldownLevel()
    {
        this.itemTreeComponent.expandsAllTreeNodes(false);

        let curentHierachy = this.itemTreeComponent.filteredHierachy;
        let openedIds = [];
        while (isDefined(curentHierachy) && curentHierachy.size === 1)
        {
            openedIds.push(curentHierachy.keys().next().value);
            curentHierachy = curentHierachy.values().next().value;
        }

        for (let id of openedIds)
        {
            this.itemTreeComponent.toggleItemIsOpen(id);
        }
    }

    _onStatusChange()
    {
        super._onStatusChange();
        this._updateApplyButton();
    }

    _updateApplyButton()
    {
        if (!isDefined(this.currentChangeRecipe))
            return;

        let canApply = true;
        let tooltip = locText("ui_hud_industry_apply_tooltip");

        if (this.parentPanel.currentState !== enumIndustryPanelState.STOPPED)
        {
            canApply = false;
            tooltip = locText("ui_hud_industry_can_not_change_while_running");
        }
        else
        {
            canApply = true;
            tooltip = locText("ui_hud_industry_apply_tooltip");
        }

        this.HTMLNodes.applyButton.classList.toggle("disabled", !canApply);
        this.HTMLNodes.applyButton.setAttribute("data-tooltip", tooltip);
    }

    _onUpdate() {}
}

