function getInventoryThemeRoot() {
  var roots = getInventoryThemeRoots();
  var i;
  for (i = 0; i < roots.length; i += 1) {
    if (isElementVisible(roots[i])) {
      return roots[i];
    }
  }
  return roots.length ? roots[0] : null;
}

function getInventoryThemeRoots() {
  var roots = [];
  var candidates = [
    document.getElementById("inventory"),
    document.getElementById("containerPanel_view"),
    document.getElementById("industryPanel_recipeBankSubPanel_wrapper")
  ];
  for (var i = 0; i < candidates.length; i += 1) {
    var root = candidates[i];
    if (!root || !root.style || typeof root.style.setProperty !== "function") {
      continue;
    }
    if (roots.indexOf(root) >= 0) {
      continue;
    }
    if (root.id === "containerPanel_view" && !(root.classList && root.classList.contains("right_container"))) {
      continue;
    }
    roots.push(root);
  }
  return roots;
}

function normalizeInventoryItemName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function refreshInventoryThemeAnnotations(root) {
  var slots;
  var i;
  if (!root || !root.querySelectorAll) {
    return;
  }
  slots = root.querySelectorAll(".item_slot");
  for (i = 0; i < slots.length; i += 1) {
    var slot = slots[i];
    var wrapper = slot.querySelector(".item_wrapper");
    var nameEl = slot.querySelector(".item_name");
    var iconEl = slot.querySelector(".item_icon");
    var normalizedName = normalizeInventoryItemName(nameEl ? nameEl.textContent : "");
    var iconBackground = iconEl && iconEl.style ? String(iconEl.style.backgroundImage || "") : "";
    var isOwnerUnclaimed = !!wrapper && !!wrapper.classList && wrapper.classList.contains("owner_unclaimed");
    var isExcludedBigfoot = normalizedName.indexOf("poin bigfoot") >= 0;
    var isCoreToolIcon;
    if (!iconBackground && iconEl && typeof window.getComputedStyle === "function") {
      iconBackground = String(window.getComputedStyle(iconEl).backgroundImage || "");
    }
    isCoreToolIcon = /iconslib\/misclib\/[^)]*tool\.png/i.test(iconBackground.replace(/\\/g, ""));
    if (isOwnerUnclaimed && !isExcludedBigfoot) {
      slot.setAttribute("data-modui-inventory-unclaimed-tool", "1");
    } else {
      slot.removeAttribute("data-modui-inventory-unclaimed-tool");
    }
    if (iconEl && iconEl.setAttribute && iconEl.removeAttribute && iconEl.style && typeof iconEl.style.setProperty === "function" && typeof iconEl.style.removeProperty === "function") {
      if (isCoreToolIcon) {
        iconEl.setAttribute("data-modui-inventory-core-tool-icon", "1");
        iconEl.style.setProperty("--modui-inventory-core-tool-icon-url", iconBackground);
      } else {
        iconEl.removeAttribute("data-modui-inventory-core-tool-icon");
        iconEl.style.removeProperty("--modui-inventory-core-tool-icon-url");
      }
    }
  }
}

function setInventoryHudLightActive(active, root) {
  var body = document.body || document.documentElement;
  if (!body || !body.setAttribute || !body.removeAttribute) {
    return;
  }
  if (active) {
    body.setAttribute("data-modui-inventory-light-active", "1");
    if (body.style && typeof body.style.setProperty === "function" && root && root.style && typeof root.style.getPropertyValue === "function") {
      body.style.setProperty("--modui-inventory-shortcut-color", root.style.getPropertyValue("--lua-probe-text-muted") || "#333c4d");
    }
  } else {
    body.removeAttribute("data-modui-inventory-light-active");
    if (body.style && typeof body.style.removeProperty === "function") {
      body.style.removeProperty("--modui-inventory-shortcut-color");
    }
  }
}

function ensureInventoryThemeStyle() {
  var styleId = "ModUiToolbox-inventory-theme-style";
  var style = document.getElementById(styleId);
  var rootSelector = "#inventory[data-lua-probe-active=\"1\"]";
  var lightRootSelector = "#inventory[data-lua-probe-active=\"1\"][data-lua-probe-theme-light=\"1\"]";
  var rightRootSelector = "#containerPanel_view[data-lua-probe-active=\"1\"]";
  var rightLightRootSelector = "#containerPanel_view[data-lua-probe-active=\"1\"][data-lua-probe-theme-light=\"1\"]";
  var recipeBankRootSelector = "#industryPanel_recipeBankSubPanel_wrapper[data-lua-probe-active=\"1\"]";
  var recipeBankLightRootSelector = "#industryPanel_recipeBankSubPanel_wrapper[data-lua-probe-active=\"1\"][data-lua-probe-theme-light=\"1\"]";
  var popupInspectorRootSelector = "body[data-lua-probe-active=\"1\"] .basic_window.item_inspector_win";
  var inspectorCollapsedHintSelectors = [
    ".item_informations_wrapper > .item_datatable > .blueprint_fields > .warning",
    ".item_informations_wrapper > .item_datatable > .recipe_fields",
    ".item_informations_wrapper > .item_datatable > .recipes_dropdown_wrapper",
    ".item_informations_wrapper > .item_datatable > .territoy_fields"
  ];
  var popupCollapsedHintSelector = inspectorCollapsedHintSelectors.map(function (selector) {
    return popupInspectorRootSelector + "[data-modui-inventory-inspector-collapsed=\"1\"] " + selector;
  }).join(",");
  var embeddedCollapsedHintSelector = inspectorCollapsedHintSelectors.map(function (selector) {
    return rootSelector + " .selected_item_inspector_wrapper[data-modui-inventory-inspector-collapsed=\"1\"] " + selector;
  }).join(",");
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    (document.head || document.documentElement || document.body).appendChild(style);
  }
  var cssText = ""
    + rootSelector + "{"
    + "background-color:var(--lua-probe-surface-main) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;}"
    + rootSelector + " .container_layout_wrapper,"
    + rootSelector + " .container_header_wrapper,"
    + rootSelector + " .container_header,"
    + rootSelector + " .wrapper_left_container_header,"
    + rootSelector + " .container_toolbar,"
    + rootSelector + " .container_body,"
    + rootSelector + " .itemsets_wrapper,"
    + rootSelector + " .itemSetView,"
    + rootSelector + " .itemset_body,"
    + rootSelector + " .item_display_wrapper.items_slots_grid,"
    + rootSelector + " .container_footer,"
    + rootSelector + " .footer_wrapper,"
    + rootSelector + " .meta_info,"
    + rootSelector + " .kbd_info{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;background-image:none !important;color:var(--lua-probe-text-muted) !important;}"
    + rootSelector + " .primary_toolbar_wrapper,"
    + rootSelector + " .secondary_toolbar_wrapper,"
    + rootSelector + " .action_input_list,"
    + rootSelector + " .containers_toggles_inputs,"
    + rootSelector + " .containers_actions_inputs_wrapper,"
    + rootSelector + " .slots_view_inputs_wrapper,"
    + rootSelector + " .itemset_filters_wrapper,"
    + rootSelector + " .searchbox_component,"
    + rootSelector + " .wrapper-dropdown .title_wrapper,"
    + rootSelector + " .filters_flyout,"
    + rootSelector + " .filters_flyout .datatree,"
    + rootSelector + " .filters_flyout .data_tree_wrapper,"
    + rootSelector + " .filters_flyout .nanopack_data_tree,"
    + rootSelector + " .filters_flyout .owner_area,"
    + rootSelector + " .selected_item_inspector_wrapper,"
    + rootSelector + " .selected_item_details_wrapper,"
    + rootSelector + " .no_market_selected_panel,"
    + rootSelector + " .meta_panel,"
    + rootSelector + " .legend_group{"
    + "background-color:var(--lua-probe-surface-elevated) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;box-shadow:none !important;}"
    + rootSelector + " .wrapper-dropdown .title_wrapper{"
    + "border:1px solid var(--lua-probe-border-strong) !important;box-sizing:border-box !important;}"
    + rootSelector + " .containerView_autoClaim_wrapper{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;border-top:1px solid var(--lua-probe-border-strong) !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;}"
    + rootSelector + " .containerView_autoClaim_wrapper .wrapper-dropdown,"
    + rootSelector + " .containerView_autoClaim_wrapper .wrapper-dropdown.open_down,"
    + rootSelector + " .containerView_autoClaim_wrapper .title_wrapper{"
    + "background-color:var(--lua-probe-surface-row) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + rootSelector + " .validation_button.containerView_autoClaim_validationButton{"
    + "background:var(--lua-probe-btn-apply-bg) !important;border:1px solid var(--lua-probe-btn-apply-border) !important;color:var(--lua-probe-btn-apply-color) !important;box-shadow:none !important;}"
    + rootSelector + " .validation_button.containerView_autoClaim_validationButton.disabled{"
    + "background:var(--lua-probe-btn-disabled-bg) !important;border-color:var(--lua-probe-btn-disabled-border) !important;color:var(--lua-probe-btn-disabled-color) !important;}"
    + rootSelector + " .itemset_tabs_list .itemset_button,"
    + rootSelector + " .itemset_tabs_list .itemset_button .item_set_tab_wrapper{"
    + "background-color:var(--lua-probe-surface-row) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;box-shadow:none !important;}"
    + rootSelector + " .itemset_tabs_list .itemset_button:not(.selected):hover,"
    + rootSelector + " .itemset_tabs_list .itemset_button:not(.selected):hover .item_set_tab_wrapper{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-accent-solid) !important;}"
    + rootSelector + " .itemset_tabs_list .itemset_button.drop-zone:not(.selected):not(.is_reference_itemset),"
    + rootSelector + " .itemset_tabs_list .itemset_button.drop-zone:not(.selected):not(.is_reference_itemset) .item_set_tab_wrapper{"
    + "background-color:var(--lua-probe-surface-row) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 999px rgba(255,255,255,0.035) !important;}"
    + rootSelector + " .itemset_tabs_list .itemset_button.selected,"
    + rootSelector + " .itemset_tabs_list .itemset_button.selected .item_set_tab_wrapper{"
    + "background:var(--lua-probe-mode-selected-bg) !important;border-color:var(--lua-probe-mode-selected-border) !important;color:var(--lua-probe-mode-selected-color) !important;box-shadow:inset 0 0 0 1px var(--lua-probe-selection-border) !important;}"
    + rootSelector + " .itemset_tabs_list .itemset_button.selected .name_and_percentage,"
    + rootSelector + " .itemset_tabs_list .itemset_button.selected .name_and_percentage span,"
    + rootSelector + " .itemset_tabs_list .itemset_button.selected .capacity_percentage_label{"
    + "color:var(--lua-probe-mode-selected-color) !important;-webkit-text-fill-color:var(--lua-probe-mode-selected-color) !important;text-shadow:none !important;}"
    + rootSelector + " .itemset_tabs_list .itemset_button .gauge_current_fill{"
    + "background-color:var(--lua-probe-warning) !important;background-image:none !important;}"
    + rootSelector + " .itemset_tabs_list .itemset_button .name_and_percentage span:not(.capacity_percentage_label),"
    + rootSelector + " .dropdown_selection_label,"
    + rootSelector + " .element_label,"
    + rootSelector + " .group_title_label,"
    + rootSelector + " .title_icon_filter,"
    + rootSelector + " .item_name,"
    + rootSelector + " .player_wallet_wrapper h3,"
    + rootSelector + " .item_quantity,"
    + rootSelector + " .key_legend span{"
    + "color:var(--lua-probe-text-muted) !important;text-shadow:none !important;}"
    + rootSelector + " .key_legend kbd{"
    + "color:#111111 !important;-webkit-text-fill-color:#111111 !important;text-shadow:none !important;}"
    + rootSelector + " .capacity_percentage_label,"
    + rootSelector + " .sort_dropdown_area .label{"
    + "color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
    + rootSelector + " .active_container_icon,"
    + rootSelector + " .active_container_icon use,"
    + rootSelector + " .search_icon,"
    + rootSelector + " .remove_search{"
    + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
    + rootSelector + " .capacity_percentage_gauge_wrapper,"
    + rootSelector + " .container_footer .progressbar .track{"
    + "background-color:var(--lua-probe-surface-deep) !important;border-color:var(--lua-probe-border-strong) !important;}"
    + rootSelector + " .container_footer .progressbar .void{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;background-image:none !important;}"
    + rootSelector + " .scrollbar_input{"
    + "background-color:var(--lua-probe-border-hover) !important;background-image:none !important;border-color:var(--lua-probe-border-hover) !important;box-shadow:none !important;}"
    + rootSelector + " .gauge_current_fill{"
    + "background-color:var(--lua-probe-accent-solid) !important;background-image:none !important;}"
    + rootSelector + " .search_box{"
    + "background:transparent !important;color:var(--lua-probe-text-muted) !important;caret-color:var(--lua-probe-accent-solid) !important;}"
    + rootSelector + " .search_box::placeholder{"
    + "color:var(--lua-probe-text-dim) !important;opacity:1 !important;}"
    + rootSelector + " .wrapper-dropdown .dropdown,"
    + rootSelector + " .wrapper-dropdown .dropdown li{"
    + "background-color:var(--lua-probe-surface-row) !important;background-image:none !important;color:var(--lua-probe-text-muted) !important;border-color:var(--lua-probe-border-strong) !important;}"
    + rootSelector + " .wrapper-dropdown .dropdown li:hover{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
    + rootSelector + " .item_slot,"
    + rootSelector + " .item_wrapper,"
    + rootSelector + " .item_body,"
    + rootSelector + " .item_name_wrapper{"
    + "background-color:var(--lua-probe-surface-row) !important;background-image:none !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-muted) !important;box-shadow:none !important;}"
    + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"],"
    + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"] .item_wrapper,"
    + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"] .item_body,"
    + lightRootSelector + " .item_slot[data-modui-inventory-unclaimed-tool=\"1\"] .item_name_wrapper{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;}"
    + lightRootSelector + " .item_slot .item_icon[data-modui-inventory-core-tool-icon=\"1\"]{"
    + "background-image:none !important;background-color:var(--lua-probe-accent-solid) !important;-webkit-mask-image:var(--modui-inventory-core-tool-icon-url) !important;-webkit-mask-repeat:no-repeat !important;-webkit-mask-position:center !important;-webkit-mask-size:contain !important;filter:none !important;opacity:1 !important;}"
    + rootSelector + " .item_slot:hover,"
    + rootSelector + " .item_slot:hover .item_wrapper,"
    + rootSelector + " .item_slot:hover .item_body,"
    + rootSelector + " .item_slot:hover .item_name_wrapper{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
    + rootSelector + " .item_slot.selected,"
    + rootSelector + " .item_slot.selected .item_wrapper,"
    + rootSelector + " .item_slot.selected .item_body,"
    + rootSelector + " .item_slot.selected .item_name_wrapper{"
    + "background:var(--lua-probe-mode-selected-bg) !important;border-color:var(--lua-probe-mode-selected-border) !important;color:var(--lua-probe-mode-selected-color) !important;box-shadow:inset 0 0 0 1px var(--lua-probe-selection-border) !important;}"
    + rootSelector + " .item_slot.selected .item_name,"
    + rootSelector + " .item_slot.selected .item_quantity,"
    + rootSelector + " .item_slot.selected .item_icon_name_label,"
    + rootSelector + " .item_slot.selected .item_name_wrapper *{"
    + "color:var(--lua-probe-mode-selected-color) !important;-webkit-text-fill-color:var(--lua-probe-mode-selected-color) !important;text-shadow:none !important;}"
    + rootSelector + " .container_toolbar svg.icon_button:not(.selected),"
    + rootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected),"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:not(.selected),"
    + rootSelector + " .secondary_toolbar_wrapper .toggleDataTree_containerView_input:not(.selected),"
    + rootSelector + " .containers_toggles_inputs svg.icon_button:not(.selected),"
    + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button:not(.selected){"
    + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + rootSelector + " .container_toolbar svg.icon_button:not(.selected):hover,"
    + rootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected):hover,"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:not(.selected):hover,"
    + rootSelector + " .secondary_toolbar_wrapper .toggleDataTree_containerView_input:not(.selected):hover,"
    + rootSelector + " .containers_toggles_inputs svg.icon_button:not(.selected):hover,"
    + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button:not(.selected):hover{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
    + rootSelector + " .container_toolbar svg.icon_button.selected,"
    + rootSelector + " .container_toolbar .toggleDataTree_containerView_input.selected,"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected,"
    + rootSelector + " .secondary_toolbar_wrapper .toggleDataTree_containerView_input.selected,"
    + rootSelector + " .containers_toggles_inputs svg.icon_button.selected,"
    + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button.selected{"
    + "background:var(--lua-probe-mode-selected-bg) !important;border-color:var(--lua-probe-mode-selected-border) !important;box-shadow:inset 0 0 0 1px var(--lua-probe-selection-border) !important;}"
    + rootSelector + " .container_toolbar svg.icon_button.disabled:not(.selected),"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled:not(.selected),"
    + rootSelector + " .containers_toggles_inputs svg.icon_button.disabled:not(.selected),"
    + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button.disabled:not(.selected){"
    + "background-color:var(--lua-probe-btn-disabled-bg) !important;border-color:var(--lua-probe-btn-disabled-border) !important;box-shadow:none !important;}"
    + rootSelector + " .close_button svg,"
    + rootSelector + " .close_button svg use,"
    + rootSelector + " .toggleDataTree_containerView_input svg,"
    + rootSelector + " .toggleDataTree_containerView_input svg use,"
    + rootSelector + " .containers_toggles_inputs svg.icon_button,"
    + rootSelector + " .containers_toggles_inputs svg.icon_button use,"
    + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button,"
    + rootSelector + " .containers_actions_inputs_wrapper svg.icon_button use,"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button,"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button use{"
    + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover,"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover use,"
    + rootSelector + " .toggleDataTree_containerView_input:hover svg,"
    + rootSelector + " .toggleDataTree_containerView_input:hover svg use{"
    + "fill:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-accent-solid) !important;}"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected,"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected use,"
    + rootSelector + " .toggleDataTree_containerView_input.selected svg,"
    + rootSelector + " .toggleDataTree_containerView_input.selected svg use{"
    + "fill:var(--lua-probe-mode-selected-color) !important;color:var(--lua-probe-mode-selected-color) !important;}"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled,"
    + rootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled use{"
    + "fill:var(--lua-probe-btn-disabled-color) !important;color:var(--lua-probe-btn-disabled-color) !important;}"
    + lightRootSelector + " .player_wallet_wrapper,"
    + lightRootSelector + " .player_wallet_wrapper h3,"
    + lightRootSelector + " .player_wallet,"
    + lightRootSelector + " .quanta_type,"
    + lightRootSelector + " .sort_dropdown_area .label,"
    + lightRootSelector + " .capacity_percentage_label,"
    + lightRootSelector + " .dropdown_selection_label,"
    + lightRootSelector + " .item_name,"
    + lightRootSelector + " .item_quantity,"
    + lightRootSelector + " .meta_panel .label,"
    + lightRootSelector + " .meta_panel .items_count_label,"
    + lightRootSelector + " .container_footer .container_pencentage.value,"
    + lightRootSelector + " .container_footer .container_mass.value,"
    + lightRootSelector + " .container_footer .volume_label .value,"
    + lightRootSelector + " .container_footer .mass_label .value,"
    + lightRootSelector + " .information_slider h5,"
    + lightRootSelector + " .key_legend span,"
    + lightRootSelector + " .key_legend kbd,"
    + lightRootSelector + " .item_inspector_error_wrapper,"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_longname,"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_description,"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value,"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value .value_label,"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value_label{"
    + "color:var(--lua-probe-text-muted) !important;text-shadow:none !important;}"
    + lightRootSelector + " .container_footer .container_pencentage.value,"
    + lightRootSelector + " .container_footer .container_mass.value,"
    + lightRootSelector + " .container_footer .volume_label .value,"
    + lightRootSelector + " .container_footer .mass_label .value{"
    + "color:color-mix(in srgb, var(--lua-probe-accent-solid) 58%, var(--lua-probe-text-muted) 42%) !important;}"
    + lightRootSelector + " .player_wallet_wrapper h3{"
    + "color:var(--lua-probe-text-dim) !important;}"
    + lightRootSelector + " .container_toolbar svg.icon_button:not(.selected),"
    + lightRootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected){"
    + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + lightRootSelector + " .container_toolbar svg.icon_button:not(.selected):hover,"
    + lightRootSelector + " .container_toolbar .toggleDataTree_containerView_input:not(.selected):hover{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
    + lightRootSelector + " .container_toolbar svg.icon_button.disabled:not(.selected){"
    + "background-color:var(--lua-probe-btn-disabled-bg) !important;border-color:var(--lua-probe-btn-disabled-border) !important;}"
    + lightRootSelector + " .close_button.close_container_button{"
    + "background:var(--lua-probe-surface-row) !important;background-image:none !important;border:1px solid var(--lua-probe-border-strong) !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;fill:var(--lua-probe-text-muted) !important;}"
    + lightRootSelector + " .close_button.close_container_button:hover{"
    + "background:var(--lua-probe-surface-row-alt) !important;background-image:none !important;border-color:var(--lua-probe-border-hover) !important;color:var(--lua-probe-text-muted) !important;fill:var(--lua-probe-text-muted) !important;}"
    + lightRootSelector + " .wrapper_left_container_header .close_button svg,"
    + lightRootSelector + " .wrapper_left_container_header .close_button svg use{"
    + "fill:var(--lua-probe-text-muted) !important;color:var(--lua-probe-text-muted) !important;}"
    + lightRootSelector + " .container_header .itemset_title,"
    + lightRootSelector + " .container_header .itemset_title.selected{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;text-shadow:none !important;}"
    + lightRootSelector + " .containerView_autoClaim_wrapper label{"
    + "color:var(--lua-probe-accent-solid) !important;-webkit-text-fill-color:var(--lua-probe-accent-solid) !important;text-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_label,"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_data .label{"
    + "color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .title_wrapper,"
    + lightRootSelector + " .selected_item_inspector_wrapper .title_wrapper .item_longname,"
    + lightRootSelector + " .selected_item_inspector_wrapper .title_wrapper .item_label{"
    + "color:rgba(248,252,249,0.96) !important;text-shadow:0 1px 2px rgba(0,0,0,0.35) !important;}"
    + lightRootSelector + " .kbd_info,"
    + lightRootSelector + " .legend_group{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;color:var(--lua-probe-text-muted) !important;}"
    + lightRootSelector + " .key_legend{"
    + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;}"
    + lightRootSelector + " .key_legend span{"
    + "color:var(--lua-probe-text-muted) !important;}"
    + lightRootSelector + " .key_legend kbd{"
    + "background:color-mix(in srgb, var(--lua-probe-accent-solid) 18%, white 82%) !important;border:1px solid color-mix(in srgb, var(--lua-probe-accent-solid) 32%, white 68%) !important;color:#111111 !important;-webkit-text-fill-color:#111111 !important;box-shadow:none !important;}"
    + lightRootSelector + " .itemset_tabs_list .itemset_button.drop-zone:not(.selected):not(.is_reference_itemset),"
    + lightRootSelector + " .itemset_tabs_list .itemset_button.drop-zone:not(.selected):not(.is_reference_itemset) .item_set_tab_wrapper{"
    + "background-color:var(--lua-probe-surface-row) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 0 999px rgba(0,0,0,0.12) !important;}"
    + "body[data-modui-inventory-light-active=\"1\"] .tools_list .shortcut{"
    + "color:var(--modui-inventory-shortcut-color, #333c4d) !important;text-shadow:0 1px 2px rgba(255,255,255,0.65) !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_inspector_wrapper,"
    + lightRootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown.open_down,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody,"
    + lightRootSelector + " .selected_item_inspector_wrapper .dropdown_no_search_result{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper{"
    + "margin-left:0.5rem !important;}"
    + rootSelector + " .selected_item_inspector_wrapper.hide{"
    + "display:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper:not(.hide),"
    + rootSelector + " .selected_item_inspector_wrapper:not(.hide) .item_inspector,"
    + rootSelector + " .selected_item_inspector_wrapper:not(.hide) .item_inspector_wrapper{"
    + "display:flex !important;flex-direction:column !important;min-height:0 !important;height:100% !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_inspector_wrapper.hide{"
    + "display:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_inspector_wrapper{"
    + "padding:0 0 0.875rem 0.5rem !important;box-sizing:border-box !important;background-color:var(--lua-probe-surface-backdrop) !important;color:var(--lua-probe-text-main) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary{"
    + "display:flex !important;align-items:center !important;gap:12px !important;min-height:48px !important;padding:10px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-backdrop) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.55) !important;flex:0 0 auto !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary-title{"
    + "flex:1 1 auto !important;min-width:0 !important;color:var(--lua-probe-text-main) !important;font-family:Play !important;font-size:15.666666984558105px !important;line-height:1.2 !important;font-weight:700 !important;letter-spacing:0 !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;text-shadow:none !important;text-transform:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary-actions{"
    + "display:flex !important;align-items:center !important;gap:8px !important;margin-left:auto !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_button_wrapper,"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_window_input{"
    + "position:static !important;top:auto !important;right:auto !important;margin:0 !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_button_wrapper{"
    + "display:flex !important;align-items:center !important;gap:8px !important;height:auto !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_window_input:not(.hide){"
    + "display:inline-flex !important;align-items:center !important;justify-content:center !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary .item_inspector_window_input.hide{"
    + "display:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-toggle{"
    + "display:inline-flex !important;align-items:center !important;justify-content:center !important;width:32px !important;height:32px !important;border:1px solid var(--lua-probe-border-strong) !important;border-radius:4px !important;background:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-main) !important;font-size:18px !important;line-height:1 !important;cursor:pointer !important;box-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-toggle:hover{"
    + "background:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
    + popupInspectorRootSelector + "{"
    + "max-height:100% !important;border:1px solid rgba(111,111,111,0.42) !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + ","
    + popupInspectorRootSelector + " .win_box,"
    + popupInspectorRootSelector + " .window_content,"
    + popupInspectorRootSelector + " .item_inspector,"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .window_titlebar,"
    + popupInspectorRootSelector + " .window_titlebar.win_active{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;background-image:none !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .window_title{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;text-shadow:none !important;}"
    + popupInspectorRootSelector + " .window_closebutton{"
    + "background:transparent !important;border:1px solid transparent !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .window_closebutton:hover{"
    + "background:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;}"
    + popupInspectorRootSelector + " .window_closebutton svg,"
    + popupInspectorRootSelector + " .window_closebutton svg use{"
    + "fill:var(--lua-probe-text-main) !important;color:var(--lua-probe-text-main) !important;}"
    + popupInspectorRootSelector + " .win_box,"
    + popupInspectorRootSelector + " .window_content,"
    + popupInspectorRootSelector + " .item_inspector,"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper{"
    + "max-height:100% !important;min-height:0 !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper.hide{"
    + "display:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_wrapper{"
    + "box-sizing:border-box !important;border-color:var(--lua-probe-border-strong) !important;}"
    + popupInspectorRootSelector + " .item_inspector .header_wrapper{"
    + "border-bottom:1px solid var(--lua-probe-border-strong) !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_longname{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-family:Play !important;font-size:15.666666984558105px !important;line-height:1.2 !important;font-weight:700 !important;letter-spacing:0 !important;text-transform:none !important;text-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_label,"
    + popupInspectorRootSelector + " .item_inspector .item_description,"
    + popupInspectorRootSelector + " .item_inspector .header_label,"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_error_wrapper{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_data .label{"
    + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_data .value{"
    + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_data .value,"
    + popupInspectorRootSelector + " .item_inspector .item_data .value .value_label,"
    + popupInspectorRootSelector + " .item_inspector .item_data .value_label{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;text-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_data .label.important{"
    + "color:var(--lua-probe-accent-solid) !important;-webkit-text-fill-color:var(--lua-probe-accent-solid) !important;font-weight:700 !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input{"
    + "background-color:var(--lua-probe-surface-row) !important;border:1px solid var(--lua-probe-border-strong) !important;border-radius:4px !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input:hover{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input svg,"
    + popupInspectorRootSelector + " .item_inspector .item_inspector_button_wrapper .item_inspector_window_input svg use{"
    + "fill:var(--lua-probe-text-main) !important;color:var(--lua-probe-text-main) !important;}"
    + popupInspectorRootSelector + " .item_inspector .wrapper-dropdown.open_down{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .wrapper-dropdown .title_wrapper,"
    + popupInspectorRootSelector + " .item_inspector .wrapper-dropdown .searchbox_component,"
    + popupInspectorRootSelector + " .item_inspector .dropdown_no_search_result{"
    + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_zone,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_generic,"
    + popupInspectorRootSelector + " .item_inspector .drillDownElementWrapper,"
    + popupInspectorRootSelector + " .item_inspector .drillDownElementChildrenZone{"
    + "background:transparent !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .drillDownElementChildrenZone{"
    + "padding-top:0 !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldownElementBody{"
    + "height:auto !important;min-height:0 !important;margin:0 !important;padding:calc(0.5rem - 2px) 0 !important;background:transparent !important;border-top:1px solid var(--lua-probe-border-strong) !important;border-bottom:none !important;align-items:center !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_root > .drilldownElementBody{"
    + "padding:calc(0.6rem - 2px) 0 !important;border-top:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-row) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldownElementBody .label,"
    + popupInspectorRootSelector + " .item_inspector .drilldownElementBody .element_label{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;letter-spacing:0 !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_generic,"
    + popupInspectorRootSelector + " .item_inspector .drillDownElementWrapper,"
    + popupInspectorRootSelector + " .item_inspector .labelAndString.drilldownElement,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_icon_label.drilldownElement,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_required_item.drilldownElement{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_root > .drilldownElementBody .label,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_root > .drilldownElementBody .element_label{"
    + "text-transform:none !important;font-weight:700 !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldownElementBody .string,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talent_groups_name_label{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
    + popupInspectorRootSelector + " .item_inspector .labelAndString.drilldownElement .value,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_icon_label.drilldownElement .value,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_required_item.drilldownElement .value{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_required_item.missing_item .value{"
    + "color:rgb(222,80,58) !important;-webkit-text-fill-color:rgb(222,80,58) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent,"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talent_body{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talents_level .level{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-strong) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldown_element_talent .talents_level .level.acquired{"
    + "background-color:var(--lua-probe-accent-solid) !important;border-color:var(--lua-probe-accent-solid) !important;}"
    + popupInspectorRootSelector + " .item_inspector .drilldownElementBody svg,"
    + popupInspectorRootSelector + " .item_inspector .drilldownElementBody svg use{"
    + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel{"
    + "display:flex !important;flex-direction:column !important;gap:10px !important;padding:10px 14px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-elevated) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08) !important;flex:0 0 auto !important;overflow:visible !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary{"
    + "display:flex !important;align-items:center !important;gap:12px !important;min-height:48px !important;padding:10px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-backdrop) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08) !important;flex:0 0 auto !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary-title{"
    + "flex:1 1 auto !important;min-width:0 !important;color:var(--lua-probe-text-main) !important;font-family:Play !important;font-size:15.666666984558105px !important;line-height:1.2 !important;font-weight:700 !important;letter-spacing:0 !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;text-shadow:none !important;text-transform:none !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary-actions{"
    + "display:flex !important;align-items:center !important;gap:8px !important;margin-left:auto !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_button_wrapper,"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_window_input{"
    + "position:static !important;top:auto !important;right:auto !important;margin:0 !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_button_wrapper{"
    + "display:flex !important;align-items:center !important;gap:8px !important;height:auto !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary .open_in_new_inspector_button{"
    + "display:none !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_window_input:not(.hide){"
    + "display:inline-flex !important;align-items:center !important;justify-content:center !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-summary .item_inspector_window_input.hide{"
    + "display:none !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-toggle{"
    + "display:inline-flex !important;align-items:center !important;justify-content:center !important;width:32px !important;height:32px !important;border:1px solid var(--lua-probe-border-strong) !important;border-radius:4px !important;background:var(--lua-probe-surface-row) !important;color:var(--lua-probe-text-main) !important;font-size:18px !important;line-height:1 !important;cursor:pointer !important;box-shadow:none !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-toggle:hover{"
    + "background:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-hover) !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel{"
    + "display:flex !important;flex-direction:column !important;gap:10px !important;padding:10px 14px 14px !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-elevated) !important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08) !important;flex:0 0 auto !important;overflow:visible !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .header_wrapper{"
    + "display:block !important;position:relative !important;margin:0 0 0.35rem 0 !important;max-height:none !important;min-height:auto !important;height:auto !important;padding:0 0 0.6rem 0 !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;flex:0 0 auto !important;align-items:normal !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_icon_wrapper{"
    + "position:static !important;display:flex !important;justify-content:center !important;align-items:center !important;width:100% !important;min-height:0 !important;height:auto !important;flex:0 0 auto !important;text-align:center !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_icon{"
    + "display:block !important;width:auto !important;max-width:42% !important;height:auto !important;min-height:0 !important;object-fit:contain !important;margin:0 auto !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_restore_count,"
    + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .item_description_wrapper{"
    + "flex:0 0 auto !important;}"
    + popupInspectorRootSelector + " .modui-inventory-inspector-top-panel .title_wrapper{"
    + "display:none !important;}"
    + popupInspectorRootSelector + " .content_wrapper{"
    + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:hidden !important;padding-top:0 !important;}"
    + popupInspectorRootSelector + " .content_wrapper .item_informations_wrapper{"
    + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:auto !important;margin-top:0 !important;}"
    + popupInspectorRootSelector + "[data-modui-inventory-inspector-collapsed=\"1\"] .modui-inventory-inspector-top-panel{"
    + "display:none !important;}"
    + popupInspectorRootSelector + "[data-modui-inventory-inspector-collapsed=\"1\"] .content_wrapper .item_informations_wrapper{"
    + "padding-top:12px !important;}"
    + popupCollapsedHintSelector + "{"
    + "display:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .header_wrapper{"
    + "display:block !important;position:relative !important;margin:0 0 0.35rem 0 !important;min-height:auto !important;height:auto !important;padding:0 0 0.6rem 0 !important;border-bottom:1px solid var(--lua-probe-border-strong) !important;flex:0 0 auto !important;align-items:normal !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_icon_wrapper{"
    + "position:static !important;display:flex !important;justify-content:center !important;align-items:center !important;width:100% !important;min-height:0 !important;height:auto !important;flex:0 0 auto !important;text-align:center !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_icon{"
    + "display:block !important;width:auto !important;max-width:42% !important;height:auto !important;min-height:0 !important;object-fit:contain !important;margin:0 auto !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_label,"
    + rootSelector + " .selected_item_inspector_wrapper .item_description,"
    + rootSelector + " .selected_item_inspector_wrapper .header_label,"
    + rootSelector + " .selected_item_inspector_wrapper .item_inspector_error_wrapper{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_longname,"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-summary-title{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_restore_count,"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .item_description_wrapper{"
    + "flex:0 0 auto !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .modui-inventory-inspector-top-panel .title_wrapper{"
    + "display:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .content_wrapper{"
    + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:hidden !important;padding-top:0 !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .content_wrapper .item_informations_wrapper{"
    + "display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important;overflow:auto !important;margin-top:0 !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_data .label{"
    + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;box-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_data .value{"
    + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_data .value,"
    + rootSelector + " .selected_item_inspector_wrapper .item_data .value .value_label,"
    + rootSelector + " .selected_item_inspector_wrapper .item_data .value_label{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;text-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .item_data .label.important{"
    + "color:var(--lua-probe-accent-solid) !important;-webkit-text-fill-color:var(--lua-probe-accent-solid) !important;font-weight:700 !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown.open_down{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown .title_wrapper,"
    + rootSelector + " .selected_item_inspector_wrapper .wrapper-dropdown .searchbox_component,"
    + rootSelector + " .selected_item_inspector_wrapper .dropdown_no_search_result{"
    + "background-color:var(--lua-probe-surface-main) !important;border-color:var(--lua-probe-border-strong) !important;color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;box-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper[data-modui-inventory-inspector-collapsed=\"1\"] .modui-inventory-inspector-top-panel{"
    + "display:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper[data-modui-inventory-inspector-collapsed=\"1\"] .content_wrapper .item_informations_wrapper{"
    + "padding-top:12px !important;}"
    + embeddedCollapsedHintSelector + "{"
    + "display:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_zone,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_generic,"
    + rootSelector + " .selected_item_inspector_wrapper .drillDownElementWrapper,"
    + rootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
    + "background:transparent !important;box-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
    + "padding-top:0 !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody{"
    + "height:auto !important;min-height:0 !important;margin:0 !important;padding:calc(0.5rem - 2px) 0 !important;background:transparent !important;border-top:1px solid var(--lua-probe-border-strong) !important;border-bottom:none !important;align-items:center !important;box-shadow:none !important;color:var(--lua-probe-text-muted) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody{"
    + "padding:calc(0.6rem - 2px) 0 !important;border-top:1px solid var(--lua-probe-border-strong) !important;background-color:var(--lua-probe-surface-row) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .label,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .element_label{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;letter-spacing:0 !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_generic,"
    + rootSelector + " .selected_item_inspector_wrapper .drillDownElementWrapper,"
    + rootSelector + " .selected_item_inspector_wrapper .labelAndString.drilldownElement,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_icon_label.drilldownElement,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_required_item.drilldownElement{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .label,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .element_label{"
    + "text-transform:none !important;font-weight:700 !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .string,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talent_groups_name_label{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .labelAndString.drilldownElement .value,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_icon_label.drilldownElement .value,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_required_item.drilldownElement .value{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_required_item.missing_item .value{"
    + "color:rgb(222,80,58) !important;-webkit-text-fill-color:rgb(222,80,58) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talent_body{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talents_level .level{"
    + "background-color:var(--lua-probe-surface-row-alt) !important;border-color:var(--lua-probe-border-strong) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talents_level .level.acquired{"
    + "background-color:var(--lua-probe-accent-solid) !important;border-color:var(--lua-probe-accent-solid) !important;}"
    + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg,"
    + rootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg use{"
    + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_zone,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_generic,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drillDownElementWrapper,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
    + "background:transparent !important;box-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drillDownElementChildrenZone{"
    + "padding-top:0 !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody{"
    + "height:auto !important;min-height:0 !important;margin:0 !important;padding:calc(0.5rem - 2px) 0 !important;background:transparent !important;border-top:1px solid rgba(84,122,135,0.22) !important;border-bottom:none !important;align-items:center !important;box-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody{"
    + "padding:calc(0.6rem - 2px) 0 !important;border-top:1px solid rgba(51,60,77,0.32) !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_data .label{"
    + "background-color:var(--lua-probe-surface-backdrop) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_data .value{"
    + "background-color:var(--lua-probe-surface-row) !important;border-color:var(--lua-probe-border-strong) !important;box-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .item_data .label.important{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-weight:700 !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .label,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .string,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .element_label,"
    + lightRootSelector + " .selected_item_inspector_wrapper .dropdown_selection_label.have_selection{"
    + "color:var(--lua-probe-text-muted) !important;text-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .label,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .element_label{"
    + "color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-weight:600 !important;letter-spacing:0 !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .label,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_root > .drilldownElementBody .element_label{"
    + "text-transform:none !important;color:var(--lua-probe-text-main) !important;-webkit-text-fill-color:var(--lua-probe-text-main) !important;font-weight:700 !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldown_element_talent .talent_groups_name_label{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;text-shadow:none !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .string{"
    + "color:var(--lua-probe-text-dim) !important;-webkit-text-fill-color:var(--lua-probe-text-dim) !important;font-weight:600 !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg,"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody svg use{"
    + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
    + lightRootSelector + " .selected_item_inspector_wrapper .drilldownElementBody .item_icon{"
    + "width:1.75rem !important;height:1.75rem !important;min-height:0 !important;}"
    + lightRootSelector + " .close_button svg,"
    + lightRootSelector + " .close_button svg use,"
    + lightRootSelector + " .toggleDataTree_containerView_input svg,"
    + lightRootSelector + " .toggleDataTree_containerView_input svg use,"
    + lightRootSelector + " .containers_toggles_inputs svg.icon_button,"
    + lightRootSelector + " .containers_toggles_inputs svg.icon_button use,"
    + lightRootSelector + " .containers_actions_inputs_wrapper svg.icon_button,"
    + lightRootSelector + " .containers_actions_inputs_wrapper svg.icon_button use,"
    + lightRootSelector + " .slots_view_inputs_wrapper svg.icon_button,"
    + lightRootSelector + " .slots_view_inputs_wrapper svg.icon_button use,"
    + lightRootSelector + " .searchbox_component svg,"
    + lightRootSelector + " .searchbox_component svg use,"
    + lightRootSelector + " .information_slider svg,"
    + lightRootSelector + " .information_slider svg use,"
    + lightRootSelector + " .item_owner .icon_fit_wrapper,"
    + lightRootSelector + " .item_owner .icon_fit_wrapper use{"
    + "fill:var(--lua-probe-text-dim) !important;color:var(--lua-probe-text-dim) !important;}"
    + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover,"
    + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button:hover use,"
    + lightRootSelector + " .toggleDataTree_containerView_input:hover svg,"
    + lightRootSelector + " .toggleDataTree_containerView_input:hover svg use{"
    + "fill:var(--lua-probe-accent-solid) !important;color:var(--lua-probe-accent-solid) !important;}"
    + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected,"
    + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.selected use,"
    + lightRootSelector + " .toggleDataTree_containerView_input.selected svg,"
    + lightRootSelector + " .toggleDataTree_containerView_input.selected svg use{"
    + "fill:var(--lua-probe-mode-selected-color) !important;color:var(--lua-probe-mode-selected-color) !important;}"
    + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled,"
    + lightRootSelector + " .secondary_toolbar_wrapper svg.icon_button.disabled use{"
    + "fill:var(--lua-probe-btn-disabled-color) !important;color:var(--lua-probe-btn-disabled-color) !important;}";
  style.textContent = cssText
    + cssText.split(lightRootSelector).join(rightLightRootSelector).split(rootSelector).join(rightRootSelector)
    + cssText.split(lightRootSelector).join(recipeBankLightRootSelector).split(rootSelector).join(recipeBankRootSelector);
}

function getInventoryInspectorCollapsed(inspector) {
  var attrValue;
  if (inspector && typeof inspector.getAttribute === "function") {
    attrValue = inspector.getAttribute("data-modui-inventory-inspector-collapsed");
    if (attrValue === "1") {
      return true;
    }
    if (attrValue === "0") {
      return false;
    }
  }
  return !!state.inventoryInspectorCollapsed;
}

function getInventoryInspectorHost(node) {
  if (!node || !node.closest) {
    return null;
  }
  return node.closest(".selected_item_inspector_wrapper, .basic_window.item_inspector_win");
}

function setInventoryInspectorCollapsed(inspector, collapsed) {
  var nextValue = !!collapsed;
  state.inventoryInspectorCollapsed = nextValue;
  if (inspector && typeof inspector.setAttribute === "function") {
    inspector.setAttribute("data-modui-inventory-inspector-collapsed", nextValue ? "1" : "0");
  }
  return nextValue;
}

function updateInventoryInspectorSummary(inspector, summary) {
  var title;
  var toggle;
  var titleNode;
  var collapsed;
  if (!inspector || !summary || !summary.querySelector) {
    return;
  }

  title = summary.querySelector(".modui-inventory-inspector-summary-title");
  toggle = summary.querySelector(".modui-inventory-inspector-toggle");
  titleNode = inspector.querySelector(".header_wrapper .item_longname") || inspector.querySelector(".item_longname");
  collapsed = getInventoryInspectorCollapsed(inspector);

  if (title) {
    title.textContent = titleNode ? String(titleNode.textContent || "").trim() : "Item";
  }
  if (toggle) {
    toggle.textContent = collapsed ? "▾" : "▴";
    toggle.setAttribute("aria-label", collapsed ? "Expand item preview" : "Collapse item preview");
    toggle.setAttribute("title", collapsed ? "Expand item preview" : "Collapse item preview");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
  setInventoryInspectorCollapsed(inspector, collapsed);
}

function clearInventoryInspectorInlineTheme(inspector) {
  var nodes;
  var i;
  if (!inspector || !inspector.querySelectorAll) {
    return;
  }

  nodes = inspector.querySelectorAll(".drilldownElementBody .label, .drilldownElementBody .element_label, .drilldownElementBody .string, .drilldown_element_talent .talent_groups_name_label");
  for (i = 0; i < nodes.length; i += 1) {
    var node = nodes[i];
    if (!node.style || typeof node.style.removeProperty !== "function") {
      continue;
    }
    node.style.removeProperty("color");
    node.style.removeProperty("-webkit-text-fill-color");
  }
}

function applyInventoryInspectorInlineTheme(inspector) {
  var labelNodes;
  var resolvedMain;
  var resolvedDim;
  var stringNodes;
  var i;
  if (!inspector || !inspector.querySelectorAll) {
    return;
  }

  try {
    var inspectorStyle = window.getComputedStyle(inspector);
    resolvedMain = String(inspectorStyle.getPropertyValue("--lua-probe-text-main") || "").trim()
      || String(inspectorStyle.getPropertyValue("--lua-probe-cm-text") || "").trim()
      || String(inspectorStyle.getPropertyValue("--lua-probe-text-muted") || "").trim()
      || "rgb(51, 60, 77)";
    resolvedDim = String(inspectorStyle.getPropertyValue("--lua-probe-text-dim") || "").trim()
      || String(inspectorStyle.getPropertyValue("--lua-probe-text-muted") || "").trim()
      || "rgb(36, 42, 54)";
  } catch (_ignoreInventoryInspectorInlineThemeTokens) {
    resolvedMain = "rgb(51, 60, 77)";
    resolvedDim = "rgb(36, 42, 54)";
  }

  labelNodes = inspector.querySelectorAll(".drilldownElementBody .label, .drilldownElementBody .element_label");
  for (i = 0; i < labelNodes.length; i += 1) {
    var labelNode = labelNodes[i];
    if (!labelNode.style || typeof labelNode.style.setProperty !== "function") {
      continue;
    }
    labelNode.style.setProperty("color", resolvedMain, "important");
    labelNode.style.setProperty("-webkit-text-fill-color", resolvedMain, "important");
  }

  stringNodes = inspector.querySelectorAll(".drilldownElementBody .string");
  for (i = 0; i < stringNodes.length; i += 1) {
    var stringNode = stringNodes[i];
    if (!stringNode.style || typeof stringNode.style.setProperty !== "function") {
      continue;
    }
    stringNode.style.setProperty("color", resolvedDim, "important");
    stringNode.style.setProperty("-webkit-text-fill-color", resolvedDim, "important");
  }

  stringNodes = inspector.querySelectorAll(".drilldown_element_talent .talent_groups_name_label");
  for (i = 0; i < stringNodes.length; i += 1) {
    var talentGroupNode = stringNodes[i];
    if (!talentGroupNode.style || typeof talentGroupNode.style.setProperty !== "function") {
      continue;
    }
    talentGroupNode.style.setProperty("color", resolvedDim, "important");
    talentGroupNode.style.setProperty("-webkit-text-fill-color", resolvedDim, "important");
  }
}

function applyInlineThemeToVisibleItemInspectors(root) {
  var scopeRoot = root && root.querySelectorAll ? root : document;
  var inspectors;
  var i;
  if (!scopeRoot || !scopeRoot.querySelectorAll) {
    return;
  }

  inspectors = scopeRoot.querySelectorAll(".item_inspector_wrapper");
  for (i = 0; i < inspectors.length; i += 1) {
    if (!isElementVisible(inspectors[i])) {
      continue;
    }
    if (state.themeEnabled) {
      applyInventoryInspectorInlineTheme(inspectors[i]);
    } else {
      clearInventoryInspectorInlineTheme(inspectors[i]);
    }
  }
}

function getInventoryThemeRootKey(root) {
  if (!root) {
    return "";
  }
  if (root.id) {
    return "#" + root.id;
  }
  return String(root.className || "");
}

function disconnectInventoryThemeObservers(keepKeys) {
  var observers = state.inventoryThemeObservers || {};
  var keys = Object.keys(observers);
  var i;
  var key;
  var entry;
  for (i = 0; i < keys.length; i += 1) {
    key = keys[i];
    if (keepKeys && keepKeys[key]) {
      continue;
    }
    entry = observers[key];
    try {
      if (entry && entry.observer && typeof entry.observer.disconnect === "function") {
        entry.observer.disconnect();
      }
    } catch (_ignoreInventoryThemeObserverDisconnect) {}
    delete observers[key];
  }
  state.inventoryThemeObservers = observers;
}

function isInventoryThemeMutationRelevant(mutation) {
  var target;
  var attrName;
  if (!mutation || state.inventoryThemeApplying || Date.now() < (state.inventoryThemeIgnoreMutationsUntil || 0)) {
    return false;
  }

  if (mutation.type === "attributes") {
    target = mutation.target || null;
    attrName = String(mutation.attributeName || "");
    if (attrName.indexOf("data-modui-") === 0) {
      return false;
    }
    if (target && target.closest && target.closest(".modui-inventory-inspector-summary, .modui-inventory-inspector-top-panel")) {
      return false;
    }
    return true;
  }

  if (mutation.type === "characterData") {
    target = mutation.target && mutation.target.parentNode ? mutation.target.parentNode : mutation.target || null;
    if (target && target.closest && target.closest(".modui-inventory-inspector-summary, .modui-inventory-inspector-top-panel")) {
      return false;
    }
    return true;
  }

  return !!(
    (mutation.addedNodes && mutation.addedNodes.length) ||
    (mutation.removedNodes && mutation.removedNodes.length)
  );
}

function ensureInventoryThemeObserver(root) {
  var observers;
  var key;
  var observer;
  if (!root || !window.MutationObserver) {
    return;
  }

  observers = state.inventoryThemeObservers || {};
  key = getInventoryThemeRootKey(root);
  if (key && observers[key] && observers[key].root === root) {
    return;
  }

  observer = new MutationObserver(function (mutations) {
    var i;
    if (!mutations || state.inventoryThemeApplying) {
      return;
    }
    for (i = 0; i < mutations.length; i += 1) {
      if (!isInventoryThemeMutationRelevant(mutations[i])) {
        continue;
      }
      state.inventoryThemeIgnoreMutationsUntil = Date.now() + 150;
      applyInlineThemeToVisibleItemInspectors(document);
      state.inventoryThemeDirty = true;
      return;
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  if (key) {
    observers[key] = {
      root: root,
      observer: observer
    };
    state.inventoryThemeObservers = observers;
  }
}

function bindInventoryInspectorToggle(toggle) {
  if (!toggle || toggle.__moduiInventoryToggleBound) {
    return;
  }

  toggle.__moduiInventoryToggleBound = true;
  toggle.addEventListener("click", function (event) {
    var inspector;
    var summary;
    var collapsed;
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    if (event && typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }

    inspector = getInventoryInspectorHost(toggle);
    collapsed = !getInventoryInspectorCollapsed(inspector);
    setInventoryInspectorCollapsed(inspector, collapsed);
    summary = inspector ? inspector.querySelector(".modui-inventory-inspector-summary") : null;
    if (inspector && summary) {
      updateInventoryInspectorSummary(inspector, summary);
    }
  });
}

function ensurePopupInventoryInspectorWindowState(inspector) {
  var wm;
  var windows;
  var entry;
  var i;
  if (!inspector || !inspector.classList || !inspector.classList.contains("item_inspector_win")) {
    return;
  }
  wm = window.windowsManager;
  windows = wm && Array.isArray(wm.windows) ? wm.windows : null;
  entry = null;
  if (windows && windows.length) {
    for (i = 0; i < windows.length; i += 1) {
      if (windows[i] && windows[i].win === inspector) {
        entry = windows[i];
        break;
      }
    }
  }
  if (entry && entry.options && typeof entry.options.maxHeight === "number" && entry.options.maxHeight < 95) {
    entry.options.maxHeight = 95;
  }
}

function resetInventoryInspectorWrapper(wrapper) {
  var header;
  var content;
  var info;
  var restore;
  var description;
  var summary;
  var topPanel;
  var buttonHost;
  var themedNodes;
  var j;
  if (!wrapper || !wrapper.querySelectorAll) {
    return;
  }

  header = wrapper.querySelector(".header_wrapper");
  content = wrapper.querySelector(".content_wrapper");
  info = wrapper.querySelector(".item_informations_wrapper");
  restore = wrapper.querySelector(".item_restore_count");
  description = wrapper.querySelector(".item_description_wrapper");
  summary = wrapper.querySelector(".modui-inventory-inspector-summary");
  topPanel = wrapper.querySelector(".modui-inventory-inspector-top-panel");
  buttonHost = wrapper.querySelector(".item_inspector_button_wrapper");
  themedNodes = wrapper.querySelectorAll(".drilldownElementBody .label, .drilldownElementBody .element_label, .drilldownElementBody .string");

  if (content) {
    if (restore && restore.parentNode !== content) {
      content.insertBefore(restore, info || null);
    }
    if (description && description.parentNode !== content) {
      content.insertBefore(description, info || null);
    }
  }
  if (header && content && header.parentNode !== wrapper) {
    wrapper.insertBefore(header, content);
  }
  if (buttonHost && header && buttonHost.parentNode !== header) {
    header.appendChild(buttonHost);
  }
  if (topPanel && topPanel.parentNode) {
    topPanel.parentNode.removeChild(topPanel);
  }
  if (summary && summary.parentNode) {
    summary.parentNode.removeChild(summary);
  }
  for (j = 0; j < themedNodes.length; j += 1) {
    var themedNode = themedNodes[j];
    if (!themedNode.style || typeof themedNode.style.removeProperty !== "function") {
      continue;
    }
    themedNode.style.removeProperty("color");
    themedNode.style.removeProperty("-webkit-text-fill-color");
  }
}

function teardownInventoryInspectorEnhancer(root) {
  var wrappers;
  var i;
  if (!root || !root.querySelectorAll) {
    return;
  }

  wrappers = root.querySelectorAll(".selected_item_inspector_wrapper .item_inspector_wrapper, .basic_window.item_inspector_win .item_inspector_wrapper");
  for (i = 0; i < wrappers.length; i += 1) {
    resetInventoryInspectorWrapper(wrappers[i]);
  }
}

function hasEnhanceableInventoryInspectorContent(inspector, wrapper, content, info) {
  var titleNode;
  var titleText;
  var errorNode;
  if (!inspector || !wrapper || !content || !info) {
    return false;
  }
  titleNode = inspector.querySelector(".header_wrapper .item_longname") || inspector.querySelector(".item_longname");
  titleText = titleNode ? String(titleNode.textContent || "").trim() : "";
  if (titleText) {
    return true;
  }
  errorNode = inspector.querySelector(".item_inspector_error_wrapper");
  if (errorNode && isElementVisible(errorNode) && /no item currently selected/i.test(String(errorNode.textContent || ""))) {
    return false;
  }
  return false;
}

function ensureInventoryInspectorEnhancer(root) {
  var inspectors;
  var i;
  if (!root || !root.querySelectorAll) {
    return;
  }

  inspectors = root.querySelectorAll(".selected_item_inspector_wrapper, .basic_window.item_inspector_win");
  for (i = 0; i < inspectors.length; i += 1) {
    var inspector = inspectors[i];
    var wrapper;
    var header;
    var content;
    var info;
    var restore;
    var description;
    var summary;
    var actions;
    var toggle;
    var buttonHost;
    var topPanel;

    if (!inspector.querySelector) {
      continue;
    }

    state.inventoryInspectorCollapsed = getInventoryInspectorCollapsed(inspector);

    wrapper = inspector.classList && inspector.classList.contains("item_inspector_win")
      ? inspector.querySelector(".item_inspector_wrapper")
      : inspector.querySelector(".item_inspector_wrapper");
    header = wrapper ? wrapper.querySelector(".header_wrapper") : null;
    content = wrapper ? wrapper.querySelector(".content_wrapper") : null;
    info = content ? content.querySelector(".item_informations_wrapper") : null;
    if (!wrapper || !header || !content || !info) {
      continue;
    }
    // Embedded inspectors can preload content while hidden in single-view mode.
    // Prepare them early so the summary/toggle is already there when that content is reused.
    if (inspector.classList && inspector.classList.contains("item_inspector_win") && !isElementVisible(inspector)) {
      continue;
    }
    ensurePopupInventoryInspectorWindowState(inspector);
    if (!state.themeEnabled && inspector.classList && inspector.classList.contains("item_inspector_win")) {
      resetInventoryInspectorWrapper(wrapper);
      continue;
    }
    if (!hasEnhanceableInventoryInspectorContent(inspector, wrapper, content, info)) {
      resetInventoryInspectorWrapper(wrapper);
      continue;
    }
    restore = wrapper.querySelector(".item_restore_count") || content.querySelector(".item_restore_count");
    description = wrapper.querySelector(".item_description_wrapper") || content.querySelector(".item_description_wrapper");
    summary = wrapper.querySelector(".modui-inventory-inspector-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "modui-inventory-inspector-summary";

      var title = document.createElement("div");
      title.className = "modui-inventory-inspector-summary-title";
      summary.appendChild(title);

      actions = document.createElement("div");
      actions.className = "modui-inventory-inspector-summary-actions";

      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "modui-inventory-inspector-toggle";

      actions.appendChild(toggle);
      summary.appendChild(actions);
      wrapper.insertBefore(summary, wrapper.firstChild);
    }

    actions = summary.querySelector(".modui-inventory-inspector-summary-actions");
    toggle = summary.querySelector(".modui-inventory-inspector-toggle");
    bindInventoryInspectorToggle(toggle);
    buttonHost = wrapper.querySelector(".item_inspector_button_wrapper");
    if (actions && buttonHost && buttonHost.parentNode !== actions) {
      actions.insertBefore(buttonHost, toggle || null);
    }

    topPanel = wrapper.querySelector(".modui-inventory-inspector-top-panel");
    if (!topPanel) {
      topPanel = document.createElement("div");
      topPanel.className = "modui-inventory-inspector-top-panel";
      wrapper.insertBefore(topPanel, content);
    }

    if (header.parentNode !== topPanel) {
      topPanel.appendChild(header);
    }
    if (restore && restore.parentNode !== topPanel) {
      topPanel.appendChild(restore);
    }
    if (description && description.parentNode !== topPanel) {
      topPanel.appendChild(description);
    }
    if (info.parentNode !== content) {
      content.appendChild(info);
    }

    updateInventoryInspectorSummary(inspector, summary);
  }
}

function ensureInventoryThemeRoot() {
  var root = getInventoryThemeRoot();
  var roots = getInventoryThemeRoots();
  var visibleRoots = [];
  var keepObserverKeys = {};
  var rootKeys = [];
  var i;
  var themeName = state.activeTheme || getDefaultThemeName();
  var theme = getThemeByName(themeName);
  var themeEnabled = !!state.themeEnabled;
  var rootVisible;
  var rootChanged;
  var themeChanged;
  var needsRefresh;
  for (i = 0; i < roots.length; i += 1) {
    if (!isElementVisible(roots[i])) {
      continue;
    }
    visibleRoots.push(roots[i]);
    keepObserverKeys[getInventoryThemeRootKey(roots[i])] = true;
    rootKeys.push(getInventoryThemeRootKey(roots[i]));
  }
  root = visibleRoots.length ? visibleRoots[0] : root;
  rootVisible = !!root && isElementVisible(root);
  rootKeys.sort();
  rootChanged = state.inventoryThemeRootKeys !== rootKeys.join("|");
  if (!rootVisible) {
    disconnectInventoryThemeObservers();
    teardownInventoryInspectorEnhancer(document);
    state.inventoryThemeRootNode = null;
    state.inventoryThemeRootKeys = "";
    state.inventoryThemeRootVisible = false;
    state.inventoryThemeAppliedTheme = "";
    state.inventoryThemeAppliedEnabled = null;
    state.inventoryThemeDirty = true;
    state.inventoryThemeApplying = false;
    setInventoryHudLightActive(false, null);
    return;
  }

  if (rootChanged) {
    state.inventoryThemeDirty = true;
  }
  disconnectInventoryThemeObservers(keepObserverKeys);
  for (i = 0; i < visibleRoots.length; i += 1) {
    ensureInventoryThemeObserver(visibleRoots[i]);
  }

  themeChanged = state.inventoryThemeAppliedTheme !== themeName ||
    state.inventoryThemeAppliedEnabled !== themeEnabled;
  needsRefresh = rootChanged || themeChanged || !!state.inventoryThemeDirty;

  state.inventoryThemeRootNode = root;
  state.inventoryThemeRootKeys = rootKeys.join("|");
  state.inventoryThemeRootVisible = true;

  ensureInventoryInspectorEnhancer(document);
  applyInlineThemeToVisibleItemInspectors(document);

  if (!needsRefresh) {
    return;
  }

  state.inventoryThemeApplying = true;
  try {
    state.inventoryThemeIgnoreMutationsUntil = Date.now() + 150;
    ensureInventoryThemeStyle();
    for (i = 0; i < roots.length; i += 1) {
      refreshInventoryThemeAnnotations(roots[i]);
      setThemeRootActive(roots[i], themeEnabled && isElementVisible(roots[i]));
    }
    setInventoryHudLightActive(themeEnabled && !!theme && !!theme.isLight, root);
    ensureInventoryInspectorEnhancer(document);
    applyInlineThemeToVisibleItemInspectors(document);

    state.inventoryThemeAppliedTheme = themeName;
    state.inventoryThemeAppliedEnabled = themeEnabled;
    if (rootChanged || themeChanged) {
      applyTheme(themeName, false);
    }
  } finally {
    state.inventoryThemeApplying = false;
    state.inventoryThemeIgnoreMutationsUntil = Date.now() + 150;
    state.inventoryThemeDirty = false;
  }
}
