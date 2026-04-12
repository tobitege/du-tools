/* global IndustrySubPanel CPPIndustryPanel FormatNumber NumberInputComponent IconsLibrary itemBank enumIndustryPanelState enumTypeProduction industryStatusLabel industryProductionTypeData computeValuePercent createSpriteSvg progressBarInfoByState enumIndustryPanelType */
/* exported ProductionSubPanel */

class ProductionSubPanel extends IndustrySubPanel
{
    constructor(parentPanel)
    {
        super(parentPanel);

        this.HTMLNodes.activeRecipeArea = document.getElementById("industryPanel_productionSubPanel_activeRecipeArea");

        this.HTMLNodes.productionArea = document.getElementById("industryPanel_productionSubPanel_productionArea");

        this.HTMLNodes.ingredientsCount = document.getElementById("industryPanel_productionSubPanel_productionArea_ingredientsCount");
        this.HTMLNodes.ingredientsList = document.getElementById("industryPanel_productionSubPanel_productionArea_ingredientsList");
        this.HTMLNodes.inputContainerCount = document.getElementById("industryPanel_productionSubPanel_productionArea_inputContainerCount");
        this.HTMLNodes.inputContainerList = document.getElementById("industryPanel_productionSubPanel_productionArea_inputContainerList");

        this.HTMLNodes.industryName = document.getElementById("industryPanel_productionSubPanel_industryName");
        this.HTMLNodes.industryIcon = document.getElementById("industryPanel_productionSubPanel_industryIcon");
        this.HTMLNodes.descriptionNode = document.getElementById("industryPanel_productionSubPanel_industryDescription");

        this.HTMLNodes.modeRunInfinity = document.getElementById("industryPanel_productionSubPanel_modeRunInfinity");
        this.HTMLNodes.modeMake = document.getElementById("industryPanel_productionSubPanel_modeMake");
        this.HTMLNodes.modeMakeLabel = document.getElementById("industryPanel_productionSubPanel_inputMakeLabel");
        this.HTMLNodes.inputMakeArea = document.getElementById("industryPanel_productionSubPanel_inputMakeArea");
        this.HTMLNodes.modeMaintain = document.getElementById("industryPanel_productionSubPanel_modeMaintain");
        this.HTMLNodes.inputMaintainArea = document.getElementById("industryPanel_productionSubPanel_inputMaintainArea");
        this.HTMLNodes.descriptionMode = document.getElementById("industryPanel_productionSubPanel_descriptionMode");

        this.HTMLNodes.claimProductsCheckbox = document.getElementById("industryPanel_productionSubPanel_claimProductsCheckbox");
        this.HTMLNodes.ownerProductName = document.getElementById("industryPanel_productionSubPanel_ownerProductText");
        this.HTMLNodes.applyClaimProduct = document.getElementById("industryPanel_productionSubPanel_claimProductsApplyButton");

        this.HTMLNodes.startButton = document.getElementById("industryPanel_productionSubPanel_startButton");
        this.HTMLNodes.finishButton = document.getElementById("industryPanel_productionSubPanel_finishButton");
        this.HTMLNodes.stopButton = document.getElementById("industryPanel_productionSubPanel_stopButton");

        this.HTMLNodes.progressionBar = document.getElementById("industryPanel_productionSubPanel_progressionBar");
        this.HTMLNodes.innerProgressionBar = document.getElementById("industryPanel_productionSubPanel_innerProgressionBar");

        this.HTMLNodes.listErrorStatus = document.getElementById("industryPanel_productionSubPanel_listError_status");
        this.HTMLNodes.listError = document.getElementById("industryPanel_productionSubPanel_listError");
        this.HTMLNodes.statusDisplay = document.getElementById("industryPanel_productionSubPanel_statusDisplay");
        this.HTMLNodes.remainingTime = document.getElementById("industryPanel_productionSubPanel_remainingTime");
        this.HTMLNodes.outputInfoCount = document.getElementById("industryPanel_productionSubPanel_outputInfoCount");
        this.HTMLNodes.outputInfoTitle = document.getElementById("industryPanel_productionSubPanel_outputInfoTitle");
        this.HTMLNodes.uptimeValue = document.getElementById("industryPanel_productionSubPanel_uptimeValue");
        this.HTMLNodes.efficiencyValue = document.getElementById("industryPanel_productionSubPanel_efficiencyValue");

        this.HTMLNodes.productsCount = document.getElementById("industryPanel_productionSubPanel_productionArea_productsCount");
        this.HTMLNodes.productsList = document.getElementById("industryPanel_productionSubPanel_productionArea_productsList");
        this.HTMLNodes.outputContainerCount = document.getElementById("industryPanel_productionSubPanel_productionArea_outputContainerCount");
        this.HTMLNodes.outputContainerList = document.getElementById("industryPanel_productionSubPanel_productionArea_outputContainerList");

        this.HTMLNodes.noRecipeMask = document.getElementById("industryPanel_productionSubPanel_noRecipeMask");

        // If there is no active recipe, there's no need to have both panels saying it
        this.HTMLNodes.noActiveRecipeWarning.innerText = "";

        this.mapIngredientsLineNodes = new Map();
        this.selectedMode = enumTypeProduction.NOT_SELECTED;

        this.messsageBox = null;

        this._bindButtons();
        this._bindModeInput();
    }

    get contextInfo()
    {
        return locText("ui_hud_industry_production_subtitle");
    }

    _querryWrapperNode()
    {
        return document.getElementById("industryPanel_productionSubPanel_wrapper");
    }

    _bindModeInput()
    {
        this.HTMLNodes.modeRunInfinity.addEventListener("click", () => this._selectMode(enumTypeProduction.RUN_INFINITY));
        this.HTMLNodes.modeMake.addEventListener("click", () => this._selectMode(enumTypeProduction.MAKE_BATCHS));
        this.HTMLNodes.modeMaintain.addEventListener("click", () => this._selectMode(enumTypeProduction.MAINTAIN_AMOUNT));

        this.inputNumberMake = new NumberInputComponent(null, 0, true);
        this.HTMLNodes.inputMakeArea.appendChild(this.inputNumberMake.wrapperNode);

        this.inputNumberMaintain = new NumberInputComponent(null, 0, true);
        this.HTMLNodes.inputMaintainArea.appendChild(this.inputNumberMaintain.wrapperNode);
    }

    _selectMode(newMode)
    {
        if (this.parentPanel.currentState === enumIndustryPanelState.STOPPED)
            this.setMode(newMode);
    }

    setMode(newMode, amountInput)
    {
        this.selectedMode = isDefined(newMode) ? newMode : enumTypeProduction.NOT_SELECTED;
        if (isDefined(amountInput))
        {
            this.inputNumberMake.setValue(0);
            this.inputNumberMaintain.setValue(0);
            if (this.selectedMode === enumTypeProduction.MAKE_BATCHS)
                this.inputNumberMake.setValue(amountInput);
            else if (this.selectedMode === enumTypeProduction.MAINTAIN_AMOUNT)
                this.inputNumberMaintain.setValue(amountInput);
        }
        this._updateButtons();
        this._updateModeInput();
    }

    _updateModeInput()
    {
        this.inputNumberMake.enable(this.parentPanel.currentState === enumIndustryPanelState.STOPPED);
        this.inputNumberMaintain.enable(this.parentPanel.currentState === enumIndustryPanelState.STOPPED);

        this.HTMLNodes.modeRunInfinity.classList.toggle("disabled", this.parentPanel.currentState !== enumIndustryPanelState.STOPPED);
        this.HTMLNodes.modeMake.classList.toggle("disabled", this.parentPanel.currentState !== enumIndustryPanelState.STOPPED);
        this.HTMLNodes.modeMaintain.classList.toggle("disabled", this.parentPanel.currentState !== enumIndustryPanelState.STOPPED);

        this.HTMLNodes.modeRunInfinity.classList.toggle("selected", this.selectedMode === enumTypeProduction.RUN_INFINITY);
        this.HTMLNodes.modeMake.classList.toggle("selected", this.selectedMode === enumTypeProduction.MAKE_BATCHS);
        this.HTMLNodes.modeMaintain.classList.toggle("selected", this.selectedMode === enumTypeProduction.MAINTAIN_AMOUNT);

        this.HTMLNodes.descriptionMode.innerHTML = industryProductionTypeData[this.selectedMode].descriptionLabel;
    }

    _bindButtons()
    {
        this.HTMLNodes.startButton.addEventListener("click", () => this._askStart());
        this.HTMLNodes.finishButton.addEventListener("click", () => this._askSoftStop());
        this.HTMLNodes.stopButton.addEventListener("click", () => this._askHardStop());

        this.HTMLNodes.applyClaimProduct.addEventListener("click", function()
        {
            if (!this._testSaveClaimButton())
                return;

            this._showValidateClaimProductMessageBox();
        }.bind(this));

        this.HTMLNodes.claimProductsCheckbox.addEventListener("click", () => this._testSaveClaimButton());
    }

    _updateButtons()
    {
        this.HTMLNodes.startButton.classList.toggle("disabled", !this._testCanStart());
        this.HTMLNodes.finishButton.classList.toggle("disabled", this.parentPanel.currentState === enumIndustryPanelState.STOPPED || this.parentPanel.currentState === enumIndustryPanelState.STOPPING);
        this.HTMLNodes.stopButton.classList.toggle("disabled", this.parentPanel.currentState === enumIndustryPanelState.STOPPED);
    }

    _testCanStart()
    {
        // no recipe no start
        if (!isDefined(this.parentPanel.currentRecipe))
            return false;

        if (!this.parentPanel.isTerritoryActive)
            return false;

        let canStart = false;
        switch (this.selectedMode)
        {
            case enumTypeProduction.RUN_INFINITY:
                canStart = true;
                break;
            case enumTypeProduction.MAKE_BATCHS:
                canStart = isDefined(this.inputNumberMake.value) && this.inputNumberMake.value > 0;
                break;
            case enumTypeProduction.MAINTAIN_AMOUNT:
                canStart = isDefined(this.inputNumberMaintain.value) && this.inputNumberMaintain.value > 0;
                break;
            case enumTypeProduction.NOT_SELECTED:
                canStart = false;
                break;
            default:
                canStart = false;
                break;
        }

        // if production mode correctly set and industrty stopped or in soft stop
        return canStart && (this.parentPanel.stopRequested || this.parentPanel.currentState === enumIndustryPanelState.STOPPED);
    }

    _askStart()
    {
        if (!this._testCanStart())
            return;

        let productionModeAmount = 0;
        if (this.selectedMode === enumTypeProduction.MAKE_BATCHS)
            productionModeAmount = this.inputNumberMake.value;
        else if (this.selectedMode === enumTypeProduction.MAINTAIN_AMOUNT)
            productionModeAmount = this.inputNumberMaintain.value;

        if (typeof CPPIndustryPanel !== "undefined" && typeof CPPIndustryPanel.start === "function")
            CPPIndustryPanel.start(this.selectedMode, productionModeAmount);
        else
            console.error("Missing CPP model : CPPIndustryPanel.start");
    }

    _askSoftStop()
    {
        if (!this.HTMLNodes.finishButton.classList.contains("disabled"))
        {
            if (typeof CPPIndustryPanel !== "undefined" && typeof CPPIndustryPanel.softStop === "function")
                CPPIndustryPanel.softStop();
            else
                console.error("Missing CPP model : CPPIndustryPanel.softStop");
        }
    }

    _askHardStop()
    {
        if (!this.HTMLNodes.stopButton.classList.contains("disabled"))
        {
            if (typeof CPPIndustryPanel !== "undefined" && typeof CPPIndustryPanel.hardStop === "function")
                CPPIndustryPanel.hardStop();
            else
                console.error("Missing CPP model : CPPIndustryPanel.hardStop");
        }
    }

    _testSaveClaimButton()
    {
        let isActif = this.initialClaimProductMode !== this.HTMLNodes.claimProductsCheckbox.checked;
        this.HTMLNodes.applyClaimProduct.classList.toggle("disabled", !isActif);
        return isActif;
    }

    _showValidateClaimProductMessageBox()
    {
        if (isDefined(this.messsageBox))
            this.messageBox.deleteMessageBox();

        let title = locText("ui_hud_industry_ownership_change_title");
        this.messageBox = new MessageBox(title, EMessageBoxButtons.OkCancel, false, true, "", "item_message_box");
        this.messageBox.onOk = function()
        {
            this._validateClaimProduct();
            this._testSaveClaimButton();
        }.bind(this);
        this.messageBox.show(true, false);
    }

    _validateClaimProduct()
    {
        let claimProductsState = this.HTMLNodes.claimProductsCheckbox.checked;
        this.initialClaimProductMode = claimProductsState;
        if (typeof CPPIndustryPanel !== "undefined" && typeof CPPIndustryPanel.updateClaimProducts === "function")
            CPPIndustryPanel.updateClaimProducts(claimProductsState);
        else
            console.error("Missing CPP model : CPPIndustryPanel.updateClaimProducts");
    }

    _clearContainers()
    {
        removeAllChildren(this.HTMLNodes.inputContainerList);
        removeAllChildren(this.HTMLNodes.outputContainerList);

        this.containersIn = [];
        this.containersOut = [];

        this.HTMLNodes.inputContainerCount.innerText = "";
        this.HTMLNodes.outputContainerCount.innerText = "";

    }

    _onUpdateContainers()
    {
        super._onUpdateContainers();
        if (!this.isVisible)
            return;
        this._clearContainers();

        let containersDataIn = this.parentPanel.containersInData;
        let containersDataOut = this.parentPanel.containersOutData;

        for (let i = 0; i < this.parentPanel.activeContainersIn; i++)
        {
            let aContainerData = containersDataIn[i];
            let containerObject = this._createContainerObject(aContainerData);
            this.containersIn.push(containerObject);
            this.HTMLNodes.inputContainerList.appendChild(containerObject.HTMLNodes.wrapper);
        }
        this.HTMLNodes.inputContainerCount.innerText = this.parentPanel.activeContainersIn + "/" + this.parentPanel.maxContainersIn + " " + locText("ui_common_label_items");

        for (let i = 0; i < this.parentPanel.activeContainersOut; i++)
        {
            let aContainerData = containersDataOut[i];
            let containerObject = this._createContainerObject(aContainerData);
            this.containersOut.push(containerObject);
            this.HTMLNodes.outputContainerList.appendChild(containerObject.HTMLNodes.wrapper);
        }
        this.HTMLNodes.outputContainerCount.innerText = this.parentPanel.activeContainersOut + "/" + this.parentPanel.maxContainersOut + " " + locText("ui_common_label_items");

        for (let i = this.parentPanel.activeContainersIn; i < 4; i++)
        {
            let node = this._createEmptyContainer();
            this.HTMLNodes.inputContainerList.appendChild(node);
        }

        for (let i = this.parentPanel.activeContainersOut; i < 1; i++)
        {
            let node = this._createEmptyContainer();
            this.HTMLNodes.outputContainerList.appendChild(node);
        }
        this._checkIngredientLineError();
    }

    _onStatusChange()
    {
        super._onStatusChange();
        if (!this.isVisible)
            return;

        this._updateButtons();
        this._updateModeInput();

        this.HTMLNodes.innerProgressionBar.style.width = (this.parentPanel.currentProgression * 100) + "%";
        for (let state in progressBarInfoByState)
        {
            let stateInfo = progressBarInfoByState[state];
            this.HTMLNodes.progressionBar.classList.remove(stateInfo.class);
        }

        this.HTMLNodes.progressionBar.classList.add(progressBarInfoByState[this.parentPanel.currentState].class);

        this.HTMLNodes.statusDisplay.innerText = industryStatusLabel[this.parentPanel.currentState];
        if (isDefined(this.parentPanel.currentRecipe))
        {
            this.HTMLNodes.remainingTime.innerText = this.parentPanel.timeRemainingLabel;
        }

        this.HTMLNodes.uptimeValue.innerText = FormatNumber.getDurationString(this.parentPanel.uptimeDuration);
        this.HTMLNodes.efficiencyValue.innerText = FormatNumber.formatToPrecision(this.parentPanel.efficiency * 100, 0) + "%";

        if (this.parentPanel.currentState === enumIndustryPanelState.JAMMED)
        {
            this.HTMLNodes.listErrorStatus.classList.remove("hide");
            // we detect no error client side but server said the industry have a problem we display a specific error
            if (this.parentPanel.errorRemarksList.length > 0)
                this.HTMLNodes.listError.innerText = locText("ui_common_label_error") + ": " + this.parentPanel.errorRemarksList.join(", ");
            else
                this.HTMLNodes.listError.innerText = locText("ui_common_label_error") + ": " + locText("server_error_code_unknown_error");
        }
        else if (this.parentPanel.currentState === enumIndustryPanelState.STOPPED && !this.parentPanel.isTerritoryActive)
        {
            this.HTMLNodes.listErrorStatus.classList.remove("hide");
            this.HTMLNodes.listError.innerText = locText("ui_hud_industry_inactive_territory");
        }
        else
        {
            this.HTMLNodes.listError.innerText = "";
            this.HTMLNodes.listErrorStatus.classList.add("hide");
        }

        this.HTMLNodes.noRecipeMask.classList.toggle("hide", isDefined(this.parentPanel.currentRecipe));
        let errorOutputContainer = this.parentPanel.currentState === enumIndustryPanelState.JAMMED && (this.parentPanel.hasErrorOutputCapacity || this.parentPanel.hasErrroMissingContainerOut);
        let errorInputContainer = this.parentPanel.currentState === enumIndustryPanelState.JAMMED && (this.parentPanel.hasErrorMissingContainerIn || this.parentPanel.hasErrorMissingingredients);
        this.HTMLNodes.outputContainerList.classList.toggle("error_production", errorOutputContainer);
        this.HTMLNodes.inputContainerList.classList.toggle("error_production", errorInputContainer);

        this.HTMLNodes.outputInfoTitle.innerText = this.parentPanel.outputInfoLabel;
        this.HTMLNodes.outputInfoCount.innerText = this.parentPanel.outputInfoCount;

        let isTransferUnit = (this.parentPanel.industryUnitType === enumIndustryPanelType.transfer);

        if (this.isTransferUnit !== isTransferUnit)
        {
            this.HTMLNodes.modeMakeLabel.innerText = isTransferUnit ? locText("ui_hud_industry_production_mode_move") : locText("ui_hud_industry_production_mode_make");
            let tooltip = isTransferUnit ? locText("ui_hud_industry_production_mode_move_tooltip") : locText("ui_hud_industry_production_mode_make_tooltip");
            this.HTMLNodes.modeMakeLabel.setAttribute("data-tooltip", tooltip);
            this.isTransferUnit = isTransferUnit;
        }
    }

    _checkIngredientLineError()
    {
        let activeRecipe = this.parentPanel.currentRecipe;
        let listMissingIngredient = this.parentPanel.getListMissingIngredientTypeIds(activeRecipe);

        for (let ingredientLine of this.mapIngredientsLineNodes.values())
        {
            ingredientLine.classList.remove("missing_ingredient");
        }

        for (let missingIngredientTypeId of listMissingIngredient)
        {
            this.mapIngredientsLineNodes.get(missingIngredientTypeId).classList.add("missing_ingredient");
        }
    }

    _clearIngredientProductsList()
    {
        removeAllChildren(this.HTMLNodes.ingredientsList);
        removeAllChildren(this.HTMLNodes.productsList);

        this.HTMLNodes.ingredientsCount.innerText = "";
        this.HTMLNodes.productsCount.innerText = "";

        this.mapIngredientsLineNodes.clear();
    }

    _updateActiveRecipeNode()
    {
        super._updateActiveRecipeNode();

        this._clearIngredientProductsList();
        let activeRecipe = this.parentPanel.currentRecipe;
        for (let ingredient of activeRecipe.ingredientsModified)
        {
            let itemLineNode = this.parentPanel._createItemNode(ingredient.typeId, ingredient.quantity);
            this.HTMLNodes.ingredientsList.appendChild(itemLineNode);
            this.mapIngredientsLineNodes.set(ingredient.typeId, itemLineNode);
        }
        this.HTMLNodes.ingredientsCount.innerText = activeRecipe.ingredientsModified.length + " " + locText("ui_common_label_items");

        for (let product of activeRecipe.productsModified)
        {
            let itemLineNode = this.parentPanel._createItemNode(product.typeId, product.quantity);
            this.HTMLNodes.productsList.appendChild(itemLineNode);
        }
        this.HTMLNodes.productsCount.innerText = activeRecipe.productsModified.length + " " + locText("ui_common_label_items");
        this._checkIngredientLineError();
    }

    show(isVisible)
    {
        super.show(isVisible);
        this._onUpdate();
    }

    _onUpdate()
    {
        if (this.isVisible)
        {
            this._onUpdateContainers();
            this._onStatusChange();
        }
    }

    _createContainerObject(containerData)
    {
        let container = {};

        container.HTMLNodes = {};
        container.HTMLNodes.wrapper = createElement(null, "div", "a_container");
        container.HTMLNodes.wrapper.setAttribute("helperid", containerData.typeId);
        container.HTMLNodes.wrapper.setAttribute("data-item-type-id", containerData.typeId);
        container.HTMLNodes.iconArea = createElement(container.HTMLNodes.wrapper, "div", "icon_area");
        container.HTMLNodes.icon = createElement(container.HTMLNodes.iconArea, "img", "icon");
        container.HTMLNodes.icon.setAttribute("src", IconsLibrary.getIconPath(itemBank.getItemDefinition(containerData.typeId).iconFilename));
        container.HTMLNodes.data = createElement(container.HTMLNodes.wrapper, "div", "data");
        container.HTMLNodes.name = createElement(container.HTMLNodes.data, "div", "container_name");
        container.HTMLNodes.name.textContent = containerData.name;

        container.HTMLNodes.capacity = createElement(container.HTMLNodes.data, "div", "capacity");
        container.HTMLNodes.capacity.innerText = FormatNumber.getVolumeInLitreString(containerData.currentCapacity) + " / " + FormatNumber.getVolumeInLitreString(containerData.maxCapacity);

        container.HTMLNodes.progressBar = createElement(container.HTMLNodes.data, "div", "progress_bar");
        container.HTMLNodes.innerProgressBar = createElement(container.HTMLNodes.progressBar, "div", "inner_progress_bar");
        let percentVolume = Math.round(computeValuePercent(containerData.currentCapacity, containerData.maxCapacity));
        container.HTMLNodes.innerProgressBar.style.width = percentVolume + "%";
        container.HTMLNodes.innerProgressBar.setAttribute("data-tooltip", percentVolume + "%");
        container.HTMLNodes.name.setAttribute("data-tooltip", containerData.name);

        return container;
    }

    _createEmptyContainer()
    {
        let wrapperNode = createElement(null, "div", [
            "a_container",
            "empty_slot"
        ]);
        let iconArea = createElement(wrapperNode, "div", "icon_area");
        let svgIcon = createSpriteSvg("icon_linked", "icon");
        iconArea.appendChild(svgIcon);
        svgIcon.classList.remove("icon_lge", "icon_hover");
        let data = createElement(wrapperNode, "div", "data");
        let nameAndButtonZone = createElement(data, "div", "container_name");
        let name = createElement(nameAndButtonZone, "div", "name");
        name.innerText = locText("ui_hud_industry_connect_containers");

        return wrapperNode;
    }

    show(isVisible)
    {
        super.show(isVisible);
        if (isVisible)
        {
            this.HTMLNodes.industryName.innerText = this.parentPanel.unitItemDefinition.fullName;
            this.HTMLNodes.industryIcon.setAttribute("src", IconsLibrary.getIconPath(this.parentPanel.unitItemDefinition.iconFilename));
            this.HTMLNodes.descriptionNode.innerText = this.parentPanel.unitItemDefinition.description;
        }
    }

    setOwner(owner, claimProducts)
    {
        this.initialClaimProductMode = claimProducts;
        this.HTMLNodes.claimProductsCheckbox.checked = claimProducts;
        let ownerName = isDefined(owner) ? owner.name : locText("ui_common_unknow_owner");
        this.HTMLNodes.ownerProductName.textContent = locText("ui_hud_industry_automatically_claim_for") + " " + ownerName;

        this.HTMLNodes.claimProductsCheckbox.disabled = !isDefined(owner);
        this._testSaveClaimButton();
    }
}

