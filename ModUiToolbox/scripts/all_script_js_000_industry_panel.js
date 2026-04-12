/* global CPPIndustryPanel PanelPage ProductionSubPanel ChangeRecipeSubPanel ContainersSubPanel industrySubPanelNames enumIndustryPanelState enumIndustryPanelType Recipe recipeBank RecipeBank enumIndustryPanelJSONState itemBank IconsLibrary FormatNumber industryProductionTypeData enumTypeProduction industrySubPanelId RecipeBankSubPanel */
/* exported */

class IndustryContainerData
{
    constructor()
    {
        this.itemQuantityById = new Map();
        this.clear();
    }

    clear()
    {
        this.name = "";
        this.typeId = "0";
        this.currentCapacity = 0;
        this.maxCapacity = 0;
        this.itemQuantityById.clear();
        this.isActive = false;
    }

    setData(containerData)
    {
        if (isDefined(containerData))
        {
            this.isActive = true;
            this.name = containerData.name;
            this.typeId = containerData.typeId;
            this.currentCapacity = containerData.currentCapacity;
            this.maxCapacity = containerData.maxCapacity;

            this.itemQuantityById.clear();
            for (let item of containerData.items)
            {
                if (!this.itemQuantityById.has(item.id))
                    this.itemQuantityById.set(item.id, 0);
                this.itemQuantityById.set(item.id, this.itemQuantityById.get(item.id) + item.quantity);
            }
        }
        else
        {
            this.clear();
        }
    }

    getQuantity(typeId)
    {
        if (this.itemQuantityById.has(typeId))
            return this.itemQuantityById.get(typeId);
        else
            return 0;
    }
}

class IndustryPanel extends PanelPage
{
    constructor()
    {
        super(document.querySelector("#industry_panel"));
        this.wrapperNode.setAttribute("data-tutorial-id-selector", "industry_panel");

        this.HTMLNodes.tipsNode = document.getElementById("industryPanel_tips");
        this.HTMLNodes.closeButton = document.getElementById("industryPanel_closeButton");

        this.HTMLNodes.closeButton.addEventListener("click", () => this.onClose());

        this.events = {};
        this.events.onStatusChange = new Event();
        this.events.onContainersChange = new Event();
        this.events.onRecipeBankUpdate = new Event();

        this.productionSubPanel = new ProductionSubPanel(this);
        this.changeRecipeSubPanel = new ChangeRecipeSubPanel(this);
        this.containersSubPanl = new ContainersSubPanel(this);
        this.recipesBankSubPanel = new RecipeBankSubPanel(this);

        this.addSubPanel(industrySubPanelId.production, industrySubPanelNames.production, null, this.productionSubPanel);
        this.addSubPanel(industrySubPanelId.recipesSelection, industrySubPanelNames.recipesSelection, null, this.changeRecipeSubPanel);
        this.addSubPanel(industrySubPanelId.containers, industrySubPanelNames.containers, null, this.containersSubPanl);
        this.addSubPanel(industrySubPanelId.recipesBank, industrySubPanelNames.recipesBank, null, this.recipesBankSubPanel);

        this.recipesBankSubPanel.recipeBankSetData.events.onAnyUpdate.subscribe(() => this.events.onRecipeBankUpdate.execute());

        this.getSubPanelMenuEntryNode(industrySubPanelId.recipesBank).classList.add("recipe_bank_menu");

        this.inputsIngredients = new Map();
        this.outputItems = new Map();
        this.currentState = enumIndustryPanelState.STOPPED;

        this.containersInData = [];
        this.containersOutData = [];
        this.schematicContainerData = null;
        this.errorRemarksList = [];

        this.mapPreviousSearchByIndustryInstanceId = new Map();

        this.claimProducts = false;
        this.industryOwner = {};
    }

    onClose()
    {
        if (typeof CPPIndustryPanel !== "undefined" && typeof CPPIndustryPanel.close === "function")
            CPPIndustryPanel.close();
        else
            console.error("Missing CPP model : CPPIndustryPanel.close");
    }

    _getRecipeFromRecipeId(recipeId)
    {
        if (!isDefined(recipeId))
            return null;

        if (this.industryUnitType === enumIndustryPanelType.classic)
            return this._modifyRecipeByIndustry(recipeBank.getRecipeById(recipeId));
        else if (this.industryUnitType === enumIndustryPanelType.transfer)
            return RecipeBank.getTransferRecipeFromTypeId(recipeId);
        else
            return null;
    }

    _getRecipesFromTypeId(typeId)
    {
        if (!isDefined(typeId))
            return null;
        if (this.industryUnitType === enumIndustryPanelType.classic)
        {
            let recipeList = recipeBank.getRecipesByTypeId(typeId);
            let modifiedRecipeList = {};
            for (let recipe of recipeList)
            {
                modifiedRecipeList[recipe.id] = this._modifyRecipeByIndustry(recipe);
            }

            return modifiedRecipeList;
        }
        else if (this.industryUnitType === enumIndustryPanelType.transfer)
        {
            let recipeList = {};
            recipeList[typeId] = RecipeBank.getTransferRecipeFromTypeId(typeId);
            return recipeList;
        }
        else
            return null;
    }

    _testCanDoRecipe(recipe)
    {
        for (let ingredient of recipe.ingredientsModified)
        {
            if (!this.inputsIngredients.has(ingredient.typeId) || this.inputsIngredients.get(ingredient.typeId) < ingredient.quantity)
                return false;
        }
        return true;
    }

    _modifyRecipeByIndustry(recipe)
    {
        if (!isDefined(recipe))
            return null;

        let modifiedRecipe = new Recipe(recipe);
        modifiedRecipe.durationModified = modifiedRecipe.durationModified * this.speedFactor;

        if (modifiedRecipe.durationModified < 1)
            modifiedRecipe.durationModified = 1;

        if (modifiedRecipe.durationModified >= this.minRecipeTime || this.industryUnitType === enumIndustryPanelType.transfer)
            return modifiedRecipe;

        let batchFactor = Math.floor(this.minRecipeTime / modifiedRecipe.durationModified);

        modifiedRecipe.durationModified = modifiedRecipe.durationModified * batchFactor;

        for (let i = 0; i < modifiedRecipe.ingredientsModified.length; i++)
        {
            modifiedRecipe.ingredientsModified[i].quantity = modifiedRecipe.ingredientsModified[i].quantity * batchFactor;
        }

        for (let i = 0; i < modifiedRecipe.productsModified.length; i++)
        {
            modifiedRecipe.productsModified[i].quantity = modifiedRecipe.productsModified[i].quantity * batchFactor;
        }
        modifiedRecipe.recomputeProducts();

        modifiedRecipe.batchSize = batchFactor;

        return modifiedRecipe;
    }

    getListMissingIngredientTypeIds(recipe)
    {
        let listMissingIngredients = [];
        if (isDefined(recipe))
        {
            for (let ingredient of recipe.ingredientsBase)
            {
                if (!this.inputsIngredients.has(ingredient.typeId) || this.inputsIngredients.get(ingredient.typeId) < ingredient.quantity)
                    listMissingIngredients.push(ingredient.typeId);
            }
        }
        return listMissingIngredients;
    }

    setContextInfo(infoText)
    {
        this.HTMLNodes.tipsNode.innerText = infoText;
    }

    updateStatus(jsonNewStatus)
    {
        let parsed = parseJSON(jsonNewStatus);
        if (!parsed.succeed)
            return;
        let newStatus = parsed.object;
        this.currentRecipe = newStatus.industryUnitState === enumIndustryPanelJSONState.STOPPED ? this._getRecipeFromRecipeId(newStatus.nextRecipeId) : new Recipe(newStatus.currentRecipeData);

        let recipeBatchFactor = this.currentRecipe !== null && isDefined(this.currentRecipe.batchSize) ? this.currentRecipe.batchSize : 1;

        this.batchSize = newStatus.industryUnitState === enumIndustryPanelJSONState.STOPPED ? recipeBatchFactor : newStatus.batchSize;
        if (this.lastJSONState !== newStatus.industryUnitState)
        {
            let typeAmount = 0;
            if (newStatus.productionType === enumTypeProduction.MAKE_BATCHS)
                typeAmount = newStatus.batchesRequested;
            else if (newStatus.productionType === enumTypeProduction.MAINTAIN_AMOUNT)
                typeAmount = newStatus.maintainProductAmount;
            this.productionSubPanel.setMode(newStatus.productionType, typeAmount);
            this.lastJSONState = newStatus.industryUnitState;
        }

        this.lastJSONState = newStatus.industryUnitState;
        if (newStatus.industryUnitState === enumIndustryPanelJSONState.STOPPED)
        {
            this.currentState = enumIndustryPanelState.STOPPED;
            this.currentProgression = 0;
        }
        else if (newStatus.industryUnitState === enumIndustryPanelJSONState.RUNNING)
        {
            if (!isDefined(this.currentRecipe))
            {
                console.error("Invalid currentRecipe while industry unit is running");
                this.currentState = enumIndustryPanelState.JAMMED;
            }
            else
            {
                if (newStatus.stopRequested)
                {
                    this.currentState = enumIndustryPanelState.STOPPING;
                }
                else
                {
                    this.currentState = enumIndustryPanelState.RUNNING;
                }
            }
            this.currentProgression = newStatus.progression;
        }
        else if (newStatus.industryUnitState === enumIndustryPanelJSONState.JAMMED_START)
        {
            this.currentState = enumIndustryPanelState.JAMMED;
            this.currentProgression = 0;
        }
        else if (newStatus.industryUnitState === enumIndustryPanelJSONState.JAMMED_END)
        {
            this.currentState = enumIndustryPanelState.JAMMED;
            this.currentProgression = 1;
        }
        else if (newStatus.industryUnitState === enumIndustryPanelJSONState.PENDING)
        {
            this.currentState = enumIndustryPanelState.PENDING;
            this.currentProgression = 0;
        }
        else
        {
            console.error("Invalid industryUnitState : " + newStatus.industryUnitState);
            this.currentState = enumIndustryPanelState.JAMMED;
            this.currentProgression = newStatus.progression;
        }

        if (isDefined(this.currentRecipe) && this.currentState !== enumIndustryPanelState.STOPPED)
        {
            this.timeRemainingLabel = FormatNumber.getDurationString((1 - this.currentProgression) * this.currentRecipe.durationModified);
        }
        else
        {
            this.timeRemainingLabel = "---";
        }

        this.stopRequested = newStatus.stopRequested;
        this.efficiency = this.currentState === enumIndustryPanelJSONState.STOPPED ? 0 : newStatus.efficiency;
        this.uptimeDuration = this.currentState === enumIndustryPanelJSONState.STOPPED ? null : newStatus.uptimeDuration;
        this.batchToProcess = newStatus.batchesRemaining;
        this.speedFactor = newStatus.speedFactor;
        this.minRecipeTime = newStatus.minRecipeTime;
        this.isTerritoryActive = newStatus.isTerritoryActive;

        this._calcOutputInfo();
        this._updateErrors();
        this.events.onStatusChange.execute();
    }

    updateContainers(jsonContainers)
    {
        let parsedData = parseJSON(jsonContainers);
        if (!parsedData.succeed)
            return;

        let containersData = parsedData.object;

        this.inputsIngredients.clear();
        this.outputItems.clear();

        // update schematic container
        if (isDefined(containersData.schematicContainer))
        {
            if (!isDefined(this.schematicContainerData))
                this.schematicContainerData = new IndustryContainerData();

            this.schematicContainerData.setData(containersData.schematicContainer);
        }
        else
        {
            this.schematicContainerData = null;
        }

        // increase container count if needed
        for (let i = this.containersInData.length; i < containersData.containersIn.length; i++)
        {
            this.containersInData.push(new IndustryContainerData());
        }

        for (let i = this.containersOutData.length; i < containersData.containersOut.length; i++)
        {
            this.containersOutData.push(new IndustryContainerData());
        }

        // update containers
        for (let i = 0; i < containersData.containersIn.length; i++)
        {
            let containerDataIn = containersData.containersIn[i];
            let aContainerData = this.containersInData[i];
            aContainerData.setData(containerDataIn);
            for (let item of containerDataIn.items)
            {
                if (!this.inputsIngredients.has(item.id))
                    this.inputsIngredients.set(item.id, 0);

                this.inputsIngredients.set(item.id, this.inputsIngredients.get(item.id) + item.quantity);
            }
        }

        for (let i = 0; i < containersData.containersOut.length; i++)
        {
            let containerDataOut = containersData.containersOut[i];
            let aContainerData = this.containersOutData[i];
            aContainerData.setData(containerDataOut);
            for (let item of containerDataOut.items)
            {
                if (!this.outputItems.has(item.id))
                    this.outputItems.set(item.id, 0);

                this.outputItems.set(item.id, this.outputItems.get(item.id) + item.quantity);
            }
        }

        // decrease container count if needed
        for (let i = containersData.containersIn.length; i < this.containersInData.length; i++)
        {
            this.containersInData[i].setData(null);
        }

        for (let i = containersData.containersOut.length; i < this.containersOutData.length; i++)
        {
            this.containersOutData[i].setData(null);
        }

        this.activeContainersIn = containersData.containersIn.length;
        this.activeContainersOut = containersData.containersOut.length;
        this._calcOutputInfo();
        this._updateErrors();
        this.events.onContainersChange.execute();
    }

    _calcOutputInfo()
    {
        let currentProductionState = this.productionSubPanel.selectedMode;

        this.outputInfoLabel = industryProductionTypeData[currentProductionState].counterLabel;

        if (currentProductionState === enumTypeProduction.MAKE_BATCHS)
        {
            if (this.currentState !== enumIndustryPanelState.STOPPED)
                this.outputInfoCount = this.batchToProcess;
            else
                this.outputInfoCount = 0;
        }
        else
        {
            this.outputInfoCount = 0;
            if (isDefined(this.currentRecipe))
            {
                for (let containerOut of this.containersOutData)
                {
                    this.outputInfoCount = this.outputInfoCount + containerOut.getQuantity(this.currentRecipe.mainProduct.typeId);
                }
            }
        }
    }

    show(isVisible, industryUnitInformationsJSON)
    {
        super.show(isVisible);
        this.lastJSONState = enumIndustryPanelJSONState.STOPPED;
        let parse = parseJSON(industryUnitInformationsJSON);

        if (isVisible && parse.succeed)
        {
            let industryInfo = parse.object;
            this.industryOwner = industryInfo.owner;
            this.claimProducts = industryInfo.claimProducts;
            this.industryUnitType = industryInfo.isTransferUnit ? enumIndustryPanelType.transfer : enumIndustryPanelType.classic;
            this.unitItemDefinition = itemBank.getItemDefinition(industryInfo.industryUnitTypeId);
            this.changeRecipeSubPanel.setRecipeList(industryInfo.productList, this.industryUnitType);
            this.maxContainersIn = industryInfo.maxContainerIn;
            this.maxContainersOut = industryInfo.maxContainerOut;
            this.selectSubPanel("production");
            this.productionSubPanel.setMode(enumTypeProduction.NOT_SELECTED, 0);
            this.productionSubPanel.setOwner(this.industryOwner, this.claimProducts);
            this.lastJSONState = null;
            this.industryInstanceId = industryInfo.industryInstanceId;
            this.changeRecipeSubPanel.setCurrentSearch(this.mapPreviousSearchByIndustryInstanceId.get(industryInfo.industryInstanceId));
            this.enableSubPanel("recipes_bank", this.industryUnitType !== enumIndustryPanelType.transfer);
        }
        else
        {
            this.industryUnitType = enumIndustryPanelType.closed;
            this.selectSubPanel(null);
            this.currentRecipe = null;
            this.changeRecipeSubPanel.setCurrentChangeRecipe(null);
        }
    }

    _createItemNode(itemTypeId, quantity)
    {
        let itemDefinition = itemBank.getItemDefinition(itemTypeId);
        let node = createElement(null, "div", "item_node");
        node.setAttribute("data-item-type-id", itemTypeId);
        node.setAttribute("helperid", itemTypeId);
        let iconNode = createElement(node, "img", "icon");
        iconNode.setAttribute("src", IconsLibrary.getIconPath(itemDefinition.iconFilename));
        let nameNode = createElement(node, "div", "name");
        nameNode.textContent = itemDefinition.fullName;

        if (isDefined(quantity))
        {
            let quantityNode = createElement(node, "div", "quantity");
            quantityNode.innerHTML = FormatNumber.getQuantityString(itemDefinition, quantity);
        }
        return node;
    }

    // Error management
    _clearErrors()
    {
        this.hasErrorMissingSchematic = false;
        this.hasErrorMissingContainerIn = false;
        this.hasErrroMissingContainerOut = false;
        this.hasErrorOutputCapacity = false;
        this.hasErrorMissingingredients = false;
        this.errorRemarksList = [];
    }

    get anyError()
    {
        return this.hasErrorMissingContainerIn || this.hasErrroMissingContainerOut || this.hasErrorOutputCapacity || this.hasErrorMissingingredients;
    }

    _testMissingSchematicError()
    {
        if (this.industryUnitType === enumIndustryPanelType.transfer)
            return;

        let mainProductId = this.currentRecipe.mainProduct.typeId;
        let mainProduct = itemBank.getItemDefinition(mainProductId);
        if (mainProduct.requiresSchematic && this.getSchematicCountMatchingItem(mainProductId, true, true) < this.batchSize)
        {
            this.hasErrorMissingSchematic = true;
            this.errorRemarksList.push(locText("ui_hud_industry_missing_schematic"));
        }

    }

    _testMissingContainerInError()
    {
        if (this.activeContainersIn === 0)
        {
            this.hasErrorMissingContainerIn = true;
            this.errorRemarksList.push(locText("ui_hud_industry_missing_input_container"));
        }
    }

    _testMissingContainerOutError()
    {
        if (this.activeContainersOut === 0)
        {
            this.hasErrroMissingContainerOut = true;
            this.errorRemarksList.push(locText("ui_hud_industry_missing_output_container"));
        }
    }

    _testMissingOutputCapacityError()
    {
        let productsVolume = 0;
        for (let product of this.currentRecipe.productsModified)
        {
            let productDefinition = itemBank.getItemDefinition(product.typeId);
            productsVolume += product.quantity * productDefinition.volume;
        }

        let availableOutCapacity = isDefined(this.containersOutData[0]) ? this.containersOutData[0].maxCapacity - this.containersOutData[0].currentCapacity : 0;
        if (availableOutCapacity < productsVolume)
        {
            this.hasErrorOutputCapacity = true;
            this.errorRemarksList.push(locText("ui_hud_industry_mising_output_storage_capacity"));
        }
    }

    _testMissingIngredientsError()
    {
        if (this.activeContainersIn !== 0 && !this._testCanDoRecipe(this.currentRecipe))
        {
            this.hasErrorMissingingredients = true;
            this.errorRemarksList.push(locText("ui_hud_industry_missing_input_ingredients"));
        }
    }

    _testInactiveTerritoryError()
    {
        if (!this.isTerritoryActive)
        {
            this.errorRemarksList.push(locText("ui_hud_industry_inactive_territory"));
        }
    }

    _updateErrors()
    {
        this._clearErrors();
        if (isDefined(this.currentRecipe))
        {
            this._testMissingContainerInError();
            this._testMissingContainerOutError();
            this._testMissingSchematicError();
            this._testMissingOutputCapacityError();
            this._testMissingIngredientsError();
            this._testInactiveTerritoryError();
        }
    }

    getSchematicCountMatchingItem(itemId, inBank, inContainer)
    {
        return this.recipesBankSubPanel.getSchematicCountMatchingItem(itemId, inBank, inContainer);
    }

    getSchematicContainer()
    {
        return this.schematicContainerData;
    }
}

var industryPanel = new IndustryPanel();

engine.on("industryPanel.show", industryPanel.show, industryPanel);
engine.on("industryPanel.updateStatus", industryPanel.updateStatus, industryPanel);
engine.on("industryPanel.updateContainers", industryPanel.updateContainers, industryPanel);
engine.on("industryPanel.selectSubPanel", industryPanel.selectSubPanel, industryPanel);

