/* global */
/* exported IndustrySubPanel enumIndustryPanelJSONState enumIndustryPanelType industrySubPanelNames progressBarInfoByState industrySubPanelId */
const enumIndustryPanelJSONState = {
    STOPPED: 0,
    RUNNING: 1,
    JAMMED_START: 2,
    JAMMED_END: 3,
    PENDING: 4
};

const enumIndustryPanelState = {
    STOPPED: 0, // (Not RUNNING)
    RUNNING: 1,
    STOPPING: 2,
    JAMMED: 3,
    PENDING: 4
};

const enumIndustryPanelType = {
    closed: 0,
    classic: 1,
    transfer: 2
};

const industryStatusLabel = {};
industryStatusLabel[enumIndustryPanelState.STOPPED] = locText("ui_hud_industry_state_stopped");
industryStatusLabel[enumIndustryPanelState.RUNNING] = locText("ui_hud_industry_state_running");
industryStatusLabel[enumIndustryPanelState.STOPPING] = locText("ui_hud_industry_state_stopping");
industryStatusLabel[enumIndustryPanelState.JAMMED] = locText("ui_hud_industry_state_jammed");
industryStatusLabel[enumIndustryPanelState.PENDING] = locText("ui_hud_industry_state_pending");

const progressBarInfoByState = {
    0: {
        class: "stopped",
        staticLabel: locText("ui_hud_industry_state_stopped")
    },
    1: {
        class: "running",
        staticLabel: locText("ui_hud_industry_state_running") + "..."
    },
    2: {
        class: "stopping",
        staticLabel: locText("ui_hud_industry_state_stopping") + "..."
    },
    3: {
        class: "jammed",
        staticLabel: locText("ui_hud_industry_state_jammed")
    },
    4: {
        class: "pending",
        staticLabel: locText("ui_hud_industry_state_pending") + "..."
    }
};

const enumTypeProduction = {
    RUN_INFINITY: 0,
    MAKE_BATCHS: 1,
    MAINTAIN_AMOUNT: 2,
    NOT_SELECTED: 3
};

const industryProductionTypeData = {};
industryProductionTypeData[enumTypeProduction.RUN_INFINITY] = {
    counterLabel: locText("ui_hud_industry_in_output_containers"),
    descriptionLabel: locText("ui_hud_industry_runmode_description_run")
};
industryProductionTypeData[enumTypeProduction.MAKE_BATCHS] = {
    counterLabel: locText("ui_hud_industry_left_to_process"),
    descriptionLabel: locText("ui_hud_industry_runmode_description_make_batchs")
};
industryProductionTypeData[enumTypeProduction.MAINTAIN_AMOUNT] = {
    counterLabel: locText("ui_hud_industry_in_output_containers"),
    descriptionLabel: locText("ui_hud_industry_runmode_description_maintain_amount")
};
industryProductionTypeData[enumTypeProduction.NOT_SELECTED] = {
    counterLabel: locText("ui_hud_industry_in_output_containers"),
    descriptionLabel: locText("ui_hud_industry_runmode_description_not_selected")
};

const industrySubPanelNames = {
    production: locText("ui_hud_industry_production_title"),
    recipesSelection: locText("ui_hud_industry_recipes_selection_title"),
    containers: locText("ui_hud_industry_containers_title"),
    recipesBank: locText("ui_hud_industry_recipes_bank_title", 0)
};

const industrySubPanelId = {
    production: "production",
    recipesSelection: "recipes",
    containers: "containers",
    recipesBank: "recipes_bank"
};

