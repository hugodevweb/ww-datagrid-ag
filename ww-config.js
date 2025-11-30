export default {
  editor: {
    label: {
      en: "Datagrid",
    },
    icon: "table",
    customStylePropertiesOrder: [
      {
        label: "General",
        isCollapsible: true,
        properties: [
          "layout",
          "height",
          "textColor",
          "borderColor",
          "wrapperBorderRadius",
        ],
      },
      {
        label: "Header",
        isCollapsible: true,
        properties: [
          "headerBackgroundColor",
          "headerTextColor",
          "headerFontWeight",
          "headerFontSize",
          "headerFontFamily",
          "headerHeightMode",
          "headerHeight",
        ],
      },
      {
        label: "Row",
        isCollapsible: true,
        properties: [
          "rowBackgroundColor",
          "rowAlternateColor",
          "rowHoverColor",
          "rowVerticalPaddingScale",
        ],
      },
      {
        label: "Column",
        isCollapsible: true,
        properties: ["columnHoverHighlight", "columnHoverColor"],
      },
      {
        label: "Cell",
        isCollapsible: true,
        properties: [
          "cellColor",
          "cellFontFamily",
          "cellFontSize",
          "cellSelectionBorderColor",
          "cellAlignmentMode",
          "cellAlignment",
        ],
      },
      {
        label: "Menu",
        isCollapsible: true,
        properties: ["menuTextColor", "menuBackgroundColor"],
      },
      {
        label: "Selection",
        isCollapsible: true,
        properties: [
          "selectedRowBackgroundColor",
          "selectionCheckboxColor",
          "focusShadow",
          "checkboxUncheckedBorderColor",
          "userFocusColor",
        ],
      },
      {
        label: "Action",
        isCollapsible: true,
        properties: [
          "actionColor",
          "actionBackgroundColor",
          "actionPadding",
          "actionBorder",
          "actionBorderRadius",
          "actionFont",
          "actionFontSize",
          "actionFontFamily",
          "actionFontWeight",
          "actionFontStyle",
          "actionLineHeight",
        ],
      },
    ],
    customSettingsPropertiesOrder: [
      "dataSource",
      "rowData",
      "supabaseTable",
      "supabaseQuery",
      "supabaseFilters",
      {
        label: "Search",
        isCollapsible: true,
        properties: [
          "enableSearch",
          "searchValue",
          "searchableColumns",
        ],
      },
      "idFormula",
      "generateColumns",
      "columns",
      {
        label: "Pagination",
        isCollapsible: true,
        properties: [
          "pagination",
          "hasPaginationSelector",
          "paginationPageSize",
          "paginationPageSizeSelector",
        ],
      },
      {
        label: "Infinite Scrolling",
        isCollapsible: true,
        properties: [
          "enableInfiniteScroll",
          "infiniteBlockSize",
        ],
      },
      {
        label: "Selection",
        properties: [
          "rowSelection",
          "enableClickSelection",
          "disableCheckboxes",
          "selectAll",
        ],
      },
      "invalidEditValueMode",
      "cellEditMode",
      "movableColumns",
      "resizableColumns",
      "rowReorder",
      "reorderInfoBox",
      "initialFilters",
      "initialSort",
      "initialColumnsOrder",
      ["lang", "localeText"],
      "enableDebugLogs",
    ],
  },
  triggerEvents: [
    {
      name: "action",
      label: { en: "On Action" },
      event: { actionName: "", row: null, id: 0, index: 0, displayIndex: 0 },
      getTestEvent: "getOnActionTestEvent",
      default: true,
    },
    {
      name: "cellValueChanged",
      label: { en: "On Cell Value Changed" },
      event: {
        oldValue: null,
        newValue: null,
        columnId: "id",
        row: null,
        isDirectUpdate: false,
      },
      getTestEvent: "getOnCellValueChangedTestEvent",
    },
    {
      name: "rowSelected",
      label: { en: "On Row Selected" },
      event: {
        row: null,
      },
      getTestEvent: "getSelectionTestEvent",
    },
    {
      name: "rowDeselected",
      label: { en: "On Row Deselected" },
      event: {
        row: null,
      },
      getTestEvent: "getSelectionTestEvent",
    },
    {
      name: "filterChanged",
      label: { en: "On Filter Changed" },
    },
    {
      name: "sortChanged",
      label: { en: "On Sort Changed" },
    },
    {
      name: "rowClicked",
      label: { en: "On Row Clicked" },
      event: {
        row: null,
        id: 0,
        index: 0,
        displayIndex: 0,
      },
      getTestEvent: "getRowClickedTestEvent",
    },
    {
      name: "rowDragStart",
      label: { en: "On Row Drag Start" },
      event: {
        row: null,
        id: 0,
      },
      getTestEvent: "getRowDragStartTestEvent",
    },
    {
      name: "rowDragged",
      label: { en: "On Row Dragged" },
      event: {
        row: null,
        id: 0,
        targetIndex: 0,
        rows: [],
      },
      getTestEvent: "getRowDraggedTestEvent",
    },
    {
      name: "columnMoved",
      label: { en: "On Column Moved" },
      event: {
        columnId: null,
        toIndex: 0,
        columnsOrder: [],
      },
      getTestEvent: "getColumnMovedTestEvent",
    },
    {
      name: "cellEditStart",
      label: { en: "On Cell Edit Start" },
      event: {
        columnId: "id",
        field: "field",
        value: null,
        row: null,
        id: 0,
        index: 0,
        displayIndex: 0,
      },
      getTestEvent: "getCellEditStartTestEvent",
    },
    {
      name: "cellEditEnd",
      label: { en: "On Cell Edit End" },
      event: {
        columnId: "id",
        field: "field",
        value: null,
        row: null,
        id: 0,
        index: 0,
        displayIndex: 0,
      },
      getTestEvent: "getCellEditEndTestEvent",
    },
    {
      name: "scroll",
      label: { en: "On Scroll" },
      event: {
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 0,
        clientHeight: 0,
        distanceFromBottom: 0,
        isNearBottom: false,
        isAtBottom: false,
        totalRows: 0,
      },
      getTestEvent: "getScrollTestEvent",
    },
  ],
  actions: [
    { label: "Reset filters", action: "resetFilters" },
    { label: "Reset sort", action: "resetSort" },
    {
      label: "Select all",
      action: "selectAll",
      args: [
        {
          name: "mode",
          type: "select",
          options: [
            { value: null, label: "Grid behavior", default: true },
            { value: "all", label: "All rows" },
            { value: "filtered", label: "Filtered rows" },
            { value: "currentPage", label: "Current page rows" },
          ],
          /* wwEditor:start */
          bindingValidation: {
            type: "string",
            enum: ["all", "filtered", "currentPage"],
            tooltip:
              "Select all behavior: 'all' to select all rows, 'filtered' to select filtered rows, 'currentPage' to select current page rows, and null if you want to fallback on the grid behavior",
          },
          /* wwEditor:end */
        },
      ],
    },
    { label: "Deselect all", action: "deselectAll" },
    {
      label: "Select row",
      action: "selectRow",
      args: [
        {
          name: "Row id",
          type: "string",
        },
      ],
    },
    {
      label: "Deselect row",
      action: "deselectRow",
      args: [
        {
          name: "Row id",
          type: "string",
        },
      ],
    },
    {
      label: "Force Datagrid refresh",
      action: "refreshData",
    },
    {
      label: "Set cell value",
      action: "setCellValue",
      args: [
        {
          name: "Row id",
          type: "string",
          /* wwEditor:start */
          bindingValidation: {
            type: "string",
            tooltip: "The ID of the row to update (must match the idFormula output)",
          },
          /* wwEditor:end */
        },
        {
          name: "Column id",
          type: "string",
          /* wwEditor:start */
          bindingValidation: {
            type: "string",
            tooltip: "The column ID (field name or actionName) to update",
          },
          /* wwEditor:end */
        },
        {
          name: "New value",
          type: "string",
          /* wwEditor:start */
          bindingValidation: {
            type: "any",
            tooltip: "The new value to set for the cell (can be any type: string, number, object, array, etc.)",
          },
          /* wwEditor:end */
        },
      ],
    },
    {
      label: "Set in focus",
      action: "setInFocus",
      args: [
        {
          name: "Row id",
          type: "string",
          /* wwEditor:start */
          bindingValidation: {
            type: "string",
            tooltip: "The ID of the row to focus (must match the idFormula output). Pass null to clear focus from all cells.",
          },
          /* wwEditor:end */
        },
        {
          name: "Column id",
          type: "string",
          /* wwEditor:start */
          bindingValidation: {
            type: "string",
            tooltip: "The column ID to focus (optional - if not provided, focuses the first column)",
          },
          /* wwEditor:end */
        },
      ],
    },
    {
      label: "Trigger cell value changed",
      action: "triggerCellValueChanged",
      args: [
        {
          name: "Row id",
          type: "string",
        },
        {
          name: "Column id",
          type: "string",
        },
        {
          name: "New value",
          type: "string",
        },
      ],
    },
    {
      label: "Stop cell editing",
      action: "stopCellEditing",
      args: [
        {
          name: "Cancel",
          type: "OnOff",
          /* wwEditor:start */
          bindingValidation: {
            type: "boolean",
            tooltip: "If true, cancels the edit and reverts to the original value. If false, saves the current value.",
          },
          /* wwEditor:end */
        },
      ],
    },
    {
      label: "Refresh row",
      action: "refreshRow",
      args: [
        {
          name: "Row id",
          type: "string",
          /* wwEditor:start */
          bindingValidation: {
            type: "string",
            tooltip: "The ID of the row to refresh from Supabase (must match the idFormula output / primary key)",
          },
          /* wwEditor:end */
        },
      ],
    },
    {
      label: "Remove row",
      action: "removeRow",
      args: [
        {
          name: "Row id",
          type: "string",
          /* wwEditor:start */
          bindingValidation: {
            type: "string",
            tooltip: "The ID of the row to remove (must match the idFormula output)",
          },
          /* wwEditor:end */
        },
      ],
    },
  ],
  properties: {
    layout: {
      type: "TextSelect",
      label: "Height Mode",
      options: {
        options: [
          { value: "fixed", label: "Fixed", default: true },
          { value: "auto", label: "Auto" },
        ],
      },
      bindable: true,
      responsive: true,
      propertyHelp: {
        tooltip:
          "Be cautious when using auto mode with a large number of rows, as it may slow down page rendering",
      },
      bindingValidation: {
        type: "string",
        tooltip: "fixed | auto",
      },
    },
    height: {
      label: { en: "Grid Height" },
      type: "Length",
      section: "style",
      options: {
        noRange: true,
      },
      bindable: true,
      classes: true,
      responsive: true,
      states: true,
      defaultValue: "400px",
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        tooltip: "Height of the grid (e.g., 400px)",
      },
      hidden: (content) => content.layout === "auto",
      /* wwEditor:end */
    },
    headerBackgroundColor: {
      type: "Color",
      label: "Background Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    headerTextColor: {
      type: "Color",
      label: "Text Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    headerFontWeight: {
      label: "Font weight",
      type: "TextSelect",
      category: "text",
      options: {
        options: [
          { value: null, label: "Default", default: true },
          { value: 100, label: "100 - Thin" },
          { value: 200, label: "200 - Extra Light" },
          { value: 300, label: "300 - Light" },
          { value: 400, label: "400 - Normal" },
          { value: 500, label: "500 - Medium" },
          { value: 600, label: "600 - Semi Bold" },
          { value: 700, label: "700 - Bold" },
          { value: 800, label: "800 - Extra Bold" },
          { value: 900, label: "900 - Black" },
        ],
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      bindingValidation: {
        markdown: "font-weight",
        type: "string",
        cssSupports: "font-weight",
      },
    },
    headerFontSize: {
      label: "Font Size",
      type: "Length",
      options: {
        unitChoices: [
          { value: "px", label: "px", min: 1, max: 100, default: true },
          { value: "em", label: "em", min: 0, max: 10, digits: 3, step: 0.1 },
          { value: "rem", label: "rem", min: 0, max: 10, digits: 3, step: 0.1 },
        ],
        noRange: true,
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      bindingValidation: {
        markdown: "font-size",
        type: "string",
        cssSupports: "font-size",
      },
    },
    textColor: {
      label: "Text Color",
      type: "Color",
      category: "text",
      options: { nullable: true },
      bindable: true,
      bindingValidation: {
        markdown: "color",
        type: "string",
        cssSupports: "color",
      },
      responsive: true,
      states: true,
      classes: true,
    },
    headerFontFamily: {
      label: "Font family",
      type: "FontFamily",
      category: "text",
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      bindingValidation: {
        markdown: "font-family",
        type: "string",
        cssSupports: "font-family",
      },
    },
    headerHeightMode: {
      type: "TextSelect",
      options: {
        options: [
          { value: null, label: "Fixed", default: true },
          { value: "auto", label: "Auto" },
        ],
      },
      label: "Height mode",
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    headerHeight: {
      label: { en: "Height" },
      type: "Length",
      options: {
        noRange: true,
        unitChoices: [
          { value: "px", label: "px", default: true },
          { value: "em", label: "em", digits: 3, step: 0.1 },
          { value: "rem", label: "rem", digits: 3, step: 0.1 },
        ],
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      hidden: (content) => content.headerHeightMode === "auto",
    },
    borderColor: {
      type: "Color",
      label: "Border Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    cellColor: {
      type: "Color",
      label: "Text Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    cellFontFamily: {
      label: "Font family",
      type: "FontFamily",
      category: "text",
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      bindingValidation: {
        markdown: "font-family",
        type: "string",
        cssSupports: "font-family",
      },
    },
    cellFontSize: {
      type: "Length",
      label: "Font Size",
      options: {
        unitChoices: [
          { value: "px", label: "px", min: 1, max: 100, default: true },
          { value: "em", label: "em", min: 0, max: 10, digits: 3, step: 0.1 },
          { value: "rem", label: "rem", min: 0, max: 10, digits: 3, step: 0.1 },
        ],
        noRange: true,
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      bindingValidation: {
        markdown: "font-size",
        type: "string",
        cssSupports: "font-size",
      },
    },
    cellSelectionBorderColor: {
      type: "Color",
      label: "Selection Border Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      bindingValidation: {
        markdown: "color",
        type: "string",
        cssSupports: "color",
      },
    },
    columnHoverHighlight: {
      type: "OnOff",
      label: "Hover Highlight",
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    columnHoverColor: {
      type: "Color",
      label: "Hover Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      propertyHelp: {
        tooltip: `Should be a semi-transparent color to allow the background color to show through.`,
      },
      hidden: (content) => !content.columnHoverHighlight,
    },
    rowBackgroundColor: {
      type: "Color",
      label: "Background Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    rowAlternateColor: {
      type: "Color",
      label: "Alternate Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    rowHoverColor: {
      type: "Color",
      label: "Hover Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      propertyHelp: {
        tooltip: `Should be a semi-transparent color to allow the background color to show through.`,
      },
    },
    selectedRowBackgroundColor: {
      type: "Color",
      label: "Selected Background Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      propertyHelp: {
        tooltip: `Should be a semi-transparent color to allow the background color to show through.`,
      },
    },
    selectionCheckboxColor: {
      type: "Color",
      label: "Selection Checkboxes Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      bindingValidation: {
        markdown: "color",
        type: "string",
        cssSupports: "color",
      },
    },
    checkboxUncheckedBorderColor: {
      type: "Color",
      label: "Checkbox Unchecked Border Color",
      options: {
        nullable: true,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      bindingValidation: {
        markdown: "color",
        type: "string",
        cssSupports: "color",
      },
    },
    focusShadow: {
      type: "Shadows",
      label: "Focus Shadow",
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      bindingValidation: {
        markdown: "shadow",
        type: "string",
        cssSupports: "shadow",
      },
    },
    rowVerticalPaddingScale: {
      type: "Number",
      label: "Vertical Padding Scale",
      options: {
        min: 0,
        max: 5,
        step: 0.1,
        default: 1,
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
    },
    menuTextColor: {
      label: "Text color",
      type: "Color",
      category: "text",
      options: { nullable: true },
      bindable: true,
      bindingValidation: {
        markdown: "color",
        type: "string",
        cssSupports: "color",
      },
      responsive: true,
      states: true,
      classes: true,
    },
    menuBackgroundColor: {
      label: "Background color",
      type: "Color",
      category: "background",
      options: { nullable: true },
      bindable: true,
      bindingValidation: {
        markdown: "background-color",
        type: "string",
        cssSupports: "background-color",
      },
      responsive: true,
      states: true,
      classes: true,
    },
    userFocusColor: {
      label: "User Focus Color",
      type: "Color",
      category: "background",
      options: { nullable: true },
      bindable: true,
      bindingValidation: {
        markdown: "background-color",
        type: "string",
        cssSupports: "background-color",
      },
      responsive: true,
      states: true,
      classes: true,
      propertyHelp: {
        tooltip: "Color used to highlight selected users in the user column dropdown",
      },
    },
    actionColor: {
      label: "Text color",
      type: "Color",
      category: "text",
      options: { nullable: true },
      bindable: true,
      bindingValidation: {
        markdown: "color",
        type: "string",
        cssSupports: "color",
      },
      responsive: true,
      states: true,
      classes: true,
    },
    actionBackgroundColor: {
      label: "Background color",
      type: "Color",
      category: "background",
      options: { nullable: true },
      bindable: true,
      bindingValidation: {
        markdown: "background-color",
        type: "string",
        cssSupports: "background-color",
      },
      responsive: true,
      states: true,
      classes: true,
    },
    actionPadding: {
      label: "Padding",
      type: "Spacing",
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      bindingValidation: {
        markdown: "padding",
        type: "string",
        cssSupports: "padding",
      },
    },
    actionBorder: {
      label: "Border",
      type: "Border",
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      bindingValidation: {
        markdown: "border",
        type: "string",
        cssSupports: "border",
      },
    },
    actionBorderRadius: {
      label: "Border radius",
      type: "Spacing",
      options: {
        isCorner: true,
        unitChoices: [
          { value: "px", label: "px", min: 0, max: 50, default: true },
          { value: "%", label: "%", min: 0, max: 100, digits: 2, step: 1 },
        ],
      },
      responsive: true,
      bindable: true,
      states: true,
      classes: true,
      bindingValidation: {
        markdown: "border-radius",
        type: "string",
        cssSupports: "border-radius",
      },
    },
    actionFont: {
      label: "Typography",
      type: "Typography",
      category: "text",
      options: (content, sidepanelContent, boundProperties) => ({
        initialValue: {
          fontSize: content["actionFontSize"],
          fontFamily: content["actionFontFamily"],
          fontWeight: content["actionFontWeight"],
          fontStyle: content["actionFontStyle"],
          lineHeight: content["actionLineHeight"],
        },
        creationDisabled:
          boundProperties["actionFontSize"] ||
          boundProperties["actionFontFamily"] ||
          boundProperties["actionFontWeight"] ||
          boundProperties["actionFontStyle"] ||
          boundProperties["actionLineHeight"],
        creationDisabledMessage:
          "Cannot create typography from bound properties",
      }),
      bindable: true,
      responsive: true,
      states: true,
      classes: true,
    },
    actionFontSize: {
      label: "Size",
      type: "Length",
      category: "text",
      options: {
        unitChoices: [
          { value: "px", label: "px", min: 1, max: 100, default: true },
          { value: "em", label: "em", min: 0, max: 10, digits: 3, step: 0.1 },
          { value: "rem", label: "rem", min: 0, max: 10, digits: 3, step: 0.1 },
        ],
        noRange: true,
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      hidden: (content, _, boundProps) =>
        content["actionFont"] || boundProps["actionFont"],
      bindingValidation: {
        markdown: "font-size",
        type: "string",
        cssSupports: "font-size",
      },
    },
    actionFontFamily: {
      label: "Font family",
      type: "FontFamily",
      category: "text",
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      hidden: (content, _, boundProps) =>
        content["actionFont"] || boundProps["actionFont"],
      bindingValidation: {
        markdown: "font-family",
        type: "string",
        cssSupports: "font-family",
      },
    },
    actionFontWeight: {
      label: "Font weight",
      type: "TextSelect",
      category: "text",
      options: {
        options: [
          { value: null, label: "Default", default: true },
          { value: 100, label: "100 - Thin" },
          { value: 200, label: "200 - Extra Light" },
          { value: 300, label: "300 - Light" },
          { value: 400, label: "400 - Normal" },
          { value: 500, label: "500 - Medium" },
          { value: 600, label: "600 - Semi Bold" },
          { value: 700, label: "700 - Bold" },
          { value: 800, label: "800 - Extra Bold" },
          { value: 900, label: "900 - Black" },
        ],
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      hidden: (content, _, boundProps) =>
        content["actionFont"] || boundProps["actionFont"],
      bindingValidation: {
        markdown: "font-weight",
        type: "string",
        cssSupports: "font-weight",
      },
    },
    actionFontStyle: {
      label: "Font Style",
      type: "TextRadioGroup",
      category: "text",
      options: {
        choices: [
          {
            value: null,
            title: "Default",
            icon: "typo-default",
            default: true,
          },
          { value: "italic", title: "Italic", icon: "typo-italic" },
        ],
      },
      responsive: true,
      states: true,
      bindable: true,
      classes: true,
      hidden: (content, _, boundProps) =>
        content["actionFont"] || boundProps["actionFont"],
      bindingValidation: {
        markdown: "font-style",
        type: "string",
        cssSupports: "font-style",
      },
    },
    actionLineHeight: {
      label: "Line height",
      type: "Length",
      category: "text",
      options: {
        unitChoices: [
          { value: "normal", label: "auto", default: true },
          { value: "px", label: "px", min: 0, max: 100 },
          { value: "%", label: "%", min: 0, max: 100 },
          { value: "em", label: "em", min: 0, max: 10, digits: 3, step: 0.1 },
          { value: "rem", label: "rem", min: 0, max: 10, digits: 3, step: 0.1 },
          { value: "unset", label: "none" },
        ],
        noRange: true,
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      hidden: (content, _, boundProps) =>
        content["actionFont"] || boundProps["actionFont"],
      bindingValidation: {
        markdown: "line-height",
        type: "string",
        cssSupports: "line-height",
      },
    },
    dataSource: {
      label: { en: "Data Source" },
      type: "TextSelect",
      section: "settings",
      bindable: true,
      defaultValue: "mapping",
      options: {
        options: [
          { value: "mapping", label: "Local Data", default: true },
          { value: "supabase", label: "Supabase" },
        ],
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        enum: ["mapping", "supabase"],
        tooltip: "Data source: 'mapping' uses local rowData, 'supabase' fetches from Supabase with server-side filtering and pagination",
      },
      propertyHelp: {
        tooltip: "Choose between local data (mapping) or Supabase for server-side data fetching with filtering and pagination.",
      },
      /* wwEditor:end */
    },
    supabaseTable: {
      label: { en: "Supabase Table" },
      type: "Text",
      section: "settings",
      bindable: true,
      hidden: (content) => content?.dataSource !== "supabase",
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        tooltip: "Name of the Supabase table to query (e.g., 'users', 'products')",
      },
      propertyHelp: {
        tooltip: "The name of the Supabase table to fetch data from. Required when data source is set to Supabase.",
      },
      /* wwEditor:end */
    },
    supabaseQuery: {
      label: { en: "Supabase Query" },
      type: "Text",
      section: "settings",
      bindable: true,
      hidden: (content) => content?.dataSource !== "supabase",
      defaultValue: "*",
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        tooltip: "Supabase select query string (e.g., '*, site:sites(id, name, code)')",
      },
      propertyHelp: {
        tooltip: "Supabase query string for selecting columns and relations. Use '*' for all columns, or specify columns and relations like '*, site:sites(id, name, code)'.",
      },
      /* wwEditor:end */
    },
    supabaseFilters: {
      label: { en: "Manual Filters" },
      type: "Array",
      section: "settings",
      bindable: true,
      hidden: (content) => content?.dataSource !== "supabase",
      defaultValue: [],
      options: {
        expandable: true,
        getItemLabel(item) {
          if (item?.field && item?.operator) {
            return `${item.field} ${item.operator} ${item.value ?? ''}`;
          }
          return "Filter";
        },
        item: {
          type: "Object",
          defaultValue: { field: "", operator: "eq", value: "" },
          options: {
            item: {
              field: {
                label: { en: "Field" },
                type: "Text",
                options: { placeholder: "e.g., organization_id" },
              },
              operator: {
                label: { en: "Operator" },
                type: "TextSelect",
                options: {
                  options: [
                    { value: "eq", label: "Equals (eq)" },
                    { value: "neq", label: "Not Equals (neq)" },
                    { value: "gt", label: "Greater Than (gt)" },
                    { value: "gte", label: "Greater or Equal (gte)" },
                    { value: "lt", label: "Less Than (lt)" },
                    { value: "lte", label: "Less or Equal (lte)" },
                    { value: "like", label: "Like (like)" },
                    { value: "ilike", label: "Case-insensitive Like (ilike)" },
                    { value: "is", label: "Is (is)" },
                    { value: "in", label: "In Array (in)" },
                    { value: "contains", label: "Contains (contains)" },
                    { value: "containedBy", label: "Contained By (containedBy)" },
                  ],
                },
              },
              value: {
                label: { en: "Value" },
                type: "Text",
                bindable: true,
                options: { placeholder: "Filter value" },
              },
            },
          },
        },
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "array",
        tooltip: "Array of filter objects: [{ field: 'org_id', operator: 'eq', value: 'xxx' }]",
      },
      propertyHelp: {
        tooltip: "Add manual filter conditions that are always applied to the Supabase query. Use 'in' operator with comma-separated values for arrays (e.g., 'value1,value2'). Use 'is' operator with 'null' or 'true'/'false' for null/boolean checks.",
      },
      /* wwEditor:end */
    },
    enableSearch: {
      label: { en: "Enable Search" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      defaultValue: false,
      hidden: (content) => content?.dataSource !== "supabase",
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "Enable or disable search functionality for Supabase data",
      },
      propertyHelp: {
        tooltip: "When enabled, allows searching across specified columns in the Supabase data source.",
      },
      /* wwEditor:end */
    },
    searchValue: {
      label: { en: "Search Value" },
      type: "Text",
      section: "settings",
      bindable: true,
      hidden: (content) => content?.dataSource !== "supabase" || !content?.enableSearch,
      defaultValue: "",
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        tooltip: "Search term to filter records across searchable columns",
      },
      propertyHelp: {
        tooltip: "Enter a search term to filter records. The search will be applied across all columns specified in 'Searchable Columns'.",
      },
      /* wwEditor:end */
    },
    searchableColumns: {
      label: { en: "Searchable Columns" },
      type: "Array",
      section: "settings",
      bindable: true,
      hidden: (content) => content?.dataSource !== "supabase" || !content?.enableSearch,
      defaultValue: [],
      options: {
        expandable: true,
        getItemLabel(item) {
          return item || "Column";
        },
        item: {
          type: "Text",
        },
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "array",
        tooltip: "Array of column field names to search in (e.g., ['name', 'email', 'description'])",
      },
      propertyHelp: {
        tooltip: "List of column field names to include in the search. The search will look for the search value in all specified columns.",
      },
      /* wwEditor:end */
    },
    enableInfiniteScroll: {
      label: { en: "Enable Infinite Scrolling" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      defaultValue: false,
      hidden: (content) => content?.dataSource !== "supabase",
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "Enable or disable infinite scrolling for Supabase data",
      },
      propertyHelp: {
        tooltip: "When enabled, the grid will lazy-load rows as you scroll. This is more efficient for large datasets than pagination. Note: Infinite scrolling and pagination are mutually exclusive.",
      },
      /* wwEditor:end */
    },
    infiniteBlockSize: {
      label: { en: "Block Size" },
      type: "Number",
      section: "settings",
      bindable: true,
      defaultValue: 100,
      hidden: (content) => content?.dataSource !== "supabase" || !content?.enableInfiniteScroll,
      /* wwEditor:start */
      bindingValidation: {
        type: "number",
        minimum: 1,
        tooltip: "Number of rows to fetch per block when scrolling",
      },
      propertyHelp: {
        tooltip: "The number of rows to fetch from Supabase in each block. Larger blocks mean fewer server requests but more data loaded at once. Recommended: 100-200 rows.",
      },
      /* wwEditor:end */
    },
    rowData: {
      label: { en: "Data" },
      type: "ObjectList",
      hidden: (content) => content?.dataSource === "supabase",
      options: {
        useSchema: true,
      },
      section: "settings",
      bindable: true,
      defaultValue: [],
      /* wwEditor:start */
      bindingValidation: {
        validations: [
          {
            type: "array",
          },
          {
            type: "object",
          },
        ],
        tooltip:
          "A collection or an array of data: \n\n`myCollection` or `[{}, {}, ...]`",
      },
      /* wwEditor:end */
    },
    cellAlignmentMode: {
      label: "Alignment Mode",
      type: "TextSelect",
      options: {
        options: [
          { value: "inherit", label: "Same as column", default: true },
          { value: "custom", label: "Custom" },
        ],
      },
    },
    cellAlignment: {
      type: "TextRadioGroup",
      label: "Alignment",
      options: {
        choices: [
          {
            value: "left",
            title: "Left",
            icon: "align-left",
            default: true,
          },
          { value: "center", title: "Center", icon: "align-center" },
          { value: "right", title: "Right", icon: "align-right" },
        ],
      },
      responsive: true,
      states: true,
      classes: true,
      bindable: true,
      section: "style",
      bindingValidation: {
        type: "string",
        enum: ["left", "center", "right"],
        tooltip: "Cell alignment: left, center, or right",
      },
      hidden: (content) => content.cellAlignmentMode !== "custom",
    },
    idFormula: {
      type: "Formula",
      label: "Unique Row Id",
      options: (content) => ({
        template: wwLib.wwUtils.getDataFromCollection(content.rowData)?.[0],
      }),
      section: "settings",
      propertyHelp: {
        tooltip:
          "A unique id per row. Very useful for performance optimization.",
      },
    },
    generateColumns: {
      type: "Button",
      options: {
        text: "Generate columns",
        color: "blue",
        action: "generateColumns",
      },
      section: "settings",
      editorOnly: true,
    },
    columns: {
      label: {
        en: "Columns",
      },
      type: "Array",
      options: {
        item: {
          type: "Object",
          options: (
            content,
            sidePanelContent,
            boundProperties,
            wwProps,
            array
          ) => ({
            singleLine: true,
            item: {
              headerName: {
                label: "Header Name",
                type: "Text",
                bindable: true,
              },
              cellDataType: {
                label: "Type",
                type: "TextSelect",
                options: {
                  options: [
                    { value: undefined, label: "Auto", default: true },
                    { value: "text", label: "Text" },
                    { value: "number", label: "Number" },
                    { value: "boolean", label: "Boolean" },
                    { value: "dateString", label: "Date" },
                    { value: "dateTime", label: "Date & Time" },
                    { value: "currency", label: "Currency" },
                    { value: "image", label: "Image" },
                    { value: "action", label: "Action" },
                    { value: "select", label: "Select" },
                    { value: "user", label: "User" },
                    { value: "custom", label: "Custom" },
                  ],
                },
              },
              info: {
                type: "InfoBox",
                options: {
                  variant: "warning",
                  content: "To select your custom cell, use the Layout view",
                },
                editorOnly: true,
                hidden: array?.item?.cellDataType !== "custom",
              },
              field: {
                label: "Key",
                type: "Text",
                hidden: array?.item?.cellDataType === "action",
              },
              supabaseFilterField: {
                label: { en: "Supabase Filter Field" },
                type: "Text",
                section: "settings",
                bindable: true,
                hidden: (content, sidePanelContent, boundProperties, wwProps, array) => {
                  // Only show when using Supabase data source
                  return content?.dataSource !== 'supabase' || array?.item?.cellDataType === "action";
                },
                propertyHelp: {
                  en: "Optional: Supabase field path for filtering (e.g., 'case_owners.profile.id'). Use dot notation for nested relationships. If empty, uses the Key field above. This is primarily used for many-to-many relationships when 'User Column Type' is set to 'manyToMany'."
                },
                /* wwEditor:start */
                bindingValidation: {
                  type: 'string',
                  tooltip: 'Supabase field path for filtering (supports dot notation for nested relationships)'
                },
                /* wwEditor:end */
              },
              supabaseSortField: {
                label: { en: "Supabase Sort Field" },
                type: "Text",
                section: "settings",
                bindable: true,
                hidden: (content, sidePanelContent, boundProperties, wwProps, array) => {
                  // Only show when using Supabase data source
                  return content?.dataSource !== 'supabase' || array?.item?.cellDataType === "action";
                },
                propertyHelp: {
                  en: "Optional: Supabase field path for sorting (e.g., 'case_owners.profile.name'). Use dot notation for nested relationships. If empty, uses the Key field above."
                },
                /* wwEditor:start */
                bindingValidation: {
                  type: 'string',
                  tooltip: 'Supabase field path for sorting (supports dot notation for nested relationships)'
                },
                /* wwEditor:end */
              },
              dateFormat: {
                label: "Date Format",
                type: "TextSelect",
                options: {
                  options: [
                    { value: "auto", label: "Auto (ISO)", default: true },
                    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                    { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                    { value: "DD MMM YYYY", label: "DD MMM YYYY" },
                  ],
                },
                hidden:
                  array?.item?.cellDataType !== "dateString" &&
                  array?.item?.cellDataType !== "dateTime",
                bindable: true,
                /* wwEditor:start */
                bindingValidation: {
                  type: "string",
                  tooltip: "Date format: auto | DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD | DD MMM YYYY",
                },
                /* wwEditor:end */
              },
              timeFormat: {
                label: "Time Format",
                type: "TextSelect",
                options: {
                  options: [
                    { value: "HH:mm", label: "24h (HH:mm)", default: true },
                    { value: "HH:mm:ss", label: "24h with seconds" },
                    { value: "hh:mm A", label: "12h (hh:mm AM/PM)" },
                  ],
                },
                hidden: array?.item?.cellDataType !== "dateTime",
                bindable: true,
                /* wwEditor:start */
                bindingValidation: {
                  type: "string",
                  tooltip: "Time format: HH:mm | HH:mm:ss | hh:mm A",
                },
                /* wwEditor:end */
              },
              currencyMode: {
                label: "Currency Mode",
                type: "TextSelect",
                options: {
                  options: [
                    { value: "column", label: "Same for all rows", default: true },
                    { value: "perRow", label: "Per row (from data)" },
                  ],
                },
                hidden: array?.item?.cellDataType !== "currency",
                bindable: true,
                /* wwEditor:start */
                bindingValidation: {
                  type: "string",
                  tooltip: "Currency mode: column (same currency for all rows) | perRow (currency code from data)",
                },
                /* wwEditor:end */
              },
              currencyCode: {
                label: "Currency Code",
                type: "Text",
                hidden:
                  array?.item?.cellDataType !== "currency" ||
                  array?.item?.currencyMode !== "column",
                bindable: true,
                defaultValue: "EUR",
                /* wwEditor:start */
                bindingValidation: {
                  type: "string",
                  tooltip: "ISO currency code (e.g., EUR, USD, GBP)",
                },
                propertyHelp: {
                  tooltip: "ISO 4217 currency code (e.g., EUR, USD, GBP, JPY)",
                },
                /* wwEditor:end */
              },
              currencyCodeField: {
                label: "Currency Code Field",
                type: "Formula",
                options: (content, sidePanelContent, boundProps, wwProps, array) => ({
                  template:
                    Array.isArray(wwLib.wwUtils.getDataFromCollection(content.rowData)) &&
                      wwLib.wwUtils.getDataFromCollection(content.rowData).length > 0
                      ? wwLib.wwUtils.getDataFromCollection(content.rowData)[0]
                      : null,
                }),
                hidden:
                  array?.item?.cellDataType !== "currency" ||
                  array?.item?.currencyMode !== "perRow",
                defaultValue: {
                  type: "f",
                  code: "context.mapping?.['currency']",
                },
                /* wwEditor:start */
                bindingValidation: {
                  type: "string",
                  tooltip: "Formula that returns the currency code from the row data",
                },
                propertyHelp: {
                  tooltip: "Formula that extracts the currency code from each row (e.g., context.mapping?.['currency'] or context.mapping?.['currencyCode'])",
                },
                /* wwEditor:end */
              },
              customFilterType: {
                label: "Data Type",
                type: "TextSelect",
                options: {
                  options: [
                    { value: "agTextColumnFilter", label: "Text", default: true },
                    { value: "agNumberColumnFilter", label: "Number" },
                    { value: "agDateColumnFilter", label: "Date" },
                  ],
                },
                hidden: array?.item?.cellDataType !== "custom",
                bindable: true,
                /* wwEditor:start */
                bindingValidation: {
                  type: "string",
                  tooltip: "Data type for filtering and sorting: agTextColumnFilter | agNumberColumnFilter | agDateColumnFilter",
                },
                propertyHelp: {
                  tooltip: "Specifies the data type for proper filtering and sorting behavior",
                },
                /* wwEditor:end */
              },
              useCustomLabel: {
                label: "Custom display value",
                type: "OnOff",
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image" ||
                  array?.item?.cellDataType === "select" ||
                  array?.item?.cellDataType === "user" ||
                  array?.item?.cellDataType === "custom",
              },
              displayLabelFormula: {
                label: "Display value",
                type: "Formula",
                options: {
                  template: _.get(
                    wwLib.wwUtils.getDataFromCollection(content.rowData)?.[0],
                    array?.item?.field
                  ),
                },
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image" ||
                  array?.item?.cellDataType === "select" ||
                  array?.item?.cellDataType === "user" ||
                  (!array?.item?.useCustomLabel && array?.item?.cellDataType !== "custom"),
                /* wwEditor:start */
                propertyHelp: {
                  tooltip: array?.item?.cellDataType === "custom"
                    ? "Formula that returns the value to use for filtering and sorting. The actual field value remains unchanged in the data. This is only used for filtering/sorting, not for display (which is handled by the custom cell renderer)."
                    : "Formula that returns the formatted value to display in the cell",
                },
                /* wwEditor:end */
              },
              useDisplayValueForFilterSort: {
                label: "Use display value for filter & sort",
                type: "OnOff",
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image" ||
                  array?.item?.cellDataType === "select" ||
                  array?.item?.cellDataType === "user" ||
                  (array?.item?.cellDataType === "custom" && !array?.item?.displayLabelFormula) ||
                  (array?.item?.cellDataType !== "custom" && !array?.item?.useCustomLabel),
                defaultValue: false,
                /* wwEditor:start */
                bindingValidation: {
                  type: "boolean",
                  tooltip: "If true, uses the display value (from displayLabelFormula) for filtering and sorting instead of the raw field value",
                },
                propertyHelp: {
                  tooltip: "When enabled, filtering and sorting will use the formatted display value instead of the original field value. For custom columns, this allows filtering/sorting by a different value than what's stored (e.g., filter by user name instead of user ID).",
                },
                /* wwEditor:end */
              },
              widthAlgo: {
                type: "TextRadioGroup",
                options: {
                  choices: [
                    { value: "fixed", label: "Fixed", default: true },
                    { value: "flex", label: "Flex" },
                  ],
                },
              },
              flex: {
                label: "Flex",
                type: "Number",
                options: {
                  min: 1,
                  max: 10,
                  step: 1,
                  noRange: true,
                  defaultValue: 1,
                },
                hidden: array?.item?.widthAlgo !== "flex",
              },
              width: {
                type: "Length",
                options: {
                  noRange: true,
                  unitChoices: [
                    { value: "px", label: "px", min: 0, max: 1300 },
                    { value: "auto", label: "auto" },
                  ],
                },
                hidden: array?.item?.widthAlgo === "flex",
              },
              minWidth: {
                label: "Min Width",
                type: "Length",
                options: {
                  noRange: true,
                  unitChoices: [
                    { value: "px", label: "px", min: 0, max: 1300 },
                    { value: "auto", label: "auto" },
                  ],
                },
              },
              maxWidth: {
                label: "Max Width",
                type: "Length",
                options: {
                  noRange: true,
                  unitChoices: [
                    { value: "px", label: "px", min: 0, max: 1300 },
                    { value: "auto", label: "auto" },
                  ],
                },
              },
              headerAlignment: {
                type: "TextRadioGroup",
                label: "Header Alignment",
                options: {
                  choices: [
                    {
                      value: "left",
                      title: "Left",
                      icon: "align-left",
                      default: true,
                    },
                    { value: "center", title: "Center", icon: "align-center" },
                    { value: "right", title: "Right", icon: "align-right" },
                  ],
                },
                responsive: true,
                states: true,
                classes: true,
                bindable: true,
                section: "style",
                bindingValidation: {
                  type: "string",
                  enum: ["left", "center", "right"],
                  tooltip: "Header alignment: left, center, or right",
                },
              },
              cellAlignment: {
                type: "TextRadioGroup",
                label: "Cell Alignment",
                options: {
                  choices: [
                    {
                      value: "left",
                      title: "Left",
                      icon: "align-left",
                      default: true,
                    },
                    { value: "center", title: "Center", icon: "align-center" },
                    { value: "right", title: "Right", icon: "align-right" },
                  ],
                },
                responsive: true,
                states: true,
                classes: true,
                bindable: true,
                section: "style",
                bindingValidation: {
                  type: "string",
                  enum: ["left", "center", "right"],
                  tooltip: "Cell alignment: left, center, or right",
                },
              },
              pinned: {
                label: "Pinned",
                type: "TextRadioGroup",
                options: {
                  choices: [
                    { value: "none", label: "None", default: true },
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" },
                  ],
                },
              },
              hide: {
                label: "Hidden",
                type: "OnOff",
                bindable: true,
                bindingValidation: {
                  type: "boolean",
                  tooltip: "True to hide the column",
                },
              },
              editable: {
                label: "Editable",
                type: "OnOff",
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image",
                bindable: true,
              },
              isDirectUpdate: {
                label: "Direct Update",
                type: "OnOff",
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image",
                bindable: true,
                defaultValue: false,
                /* wwEditor:start */
                bindingValidation: {
                  type: "boolean",
                  tooltip: "If true, indicates this column should be directly updated in the data source",
                },
                propertyHelp: {
                  tooltip: "Use this to flag columns that should be directly updated versus those requiring special handling",
                },
                /* wwEditor:end */
              },
              filter: {
                label: "Filter",
                type: "OnOff",
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image",
                bindable: true,
              },
              sortable: {
                label: "Sortable",
                type: "OnOff",
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image",
                bindable: true,
              },
              suppressRowInteraction: {
                label: "Suppress Row Interaction",
                type: "OnOff",
                hidden: array?.item?.cellDataType === "action",
                bindable: true,
                defaultValue: false,
                /* wwEditor:start */
                bindingValidation: {
                  type: "boolean",
                  tooltip: "Prevents row hover and focus styling when interacting with this column's cells",
                },
                propertyHelp: {
                  tooltip: "Enable this for columns with buttons or interactive elements to prevent row focus/hover effects when clicking",
                },
                /* wwEditor:end */
              },
              validation: {
                label: { en: "Validation Rules" },
                type: "Array",
                bindable: true,
                hidden:
                  array?.item?.cellDataType === "action" ||
                  array?.item?.cellDataType === "image" ||
                  array?.item?.editable === false,
                options: {
                  expandable: true,
                  getItemLabel(item) {
                    if (!item?.type) return "Validation Rule";
                    const typeLabels = {
                      required: "Required",
                      minLength: `Min Length: ${item?.value || ""}`,
                      maxLength: `Max Length: ${item?.value || ""}`,
                      min: `Min: ${item?.value || ""}`,
                      max: `Max: ${item?.value || ""}`,
                      pattern: "Pattern",
                      custom: "Custom",
                    };
                    return typeLabels[item.type] || item.type;
                  },
                  item: {
                    type: "Object",
                    defaultValue: { type: "required" },
                    options: {
                      item: {
                        type: {
                          label: "Type",
                          type: "TextSelect",
                          options: {
                            options: [
                              { value: "required", label: "Required", default: true },
                              { value: "minLength", label: "Min Length" },
                              { value: "maxLength", label: "Max Length" },
                              { value: "min", label: "Min" },
                              { value: "max", label: "Max" },
                              { value: "pattern", label: "Pattern" },
                              { value: "custom", label: "Custom" },
                            ],
                          },
                        },
                        value: {
                          label: "Value",
                          type: "Text",
                          hidden:
                            array?.item?.type === "required" || !array?.item?.type,
                          bindable: true,
                        },
                        custom: {
                          label: "Custom Formula",
                          type: "Formula",
                          hidden: array?.item?.type !== "custom",
                          options: (content, sidePanelContent, boundProps, wwProps, array) => ({
                            template:
                              Array.isArray(wwLib.wwUtils.getDataFromCollection(content.rowData)) &&
                              wwLib.wwUtils.getDataFromCollection(content.rowData).length > 0
                                ? wwLib.wwUtils.getDataFromCollection(content.rowData)[0]
                                : null,
                          }),
                          defaultValue: {
                            type: "f",
                            code: "true",
                          },
                          /* wwEditor:start */
                          bindingValidation: {
                            type: "string",
                            tooltip: "Formula that returns true if valid, false if invalid",
                          },
                          propertyHelp: {
                            tooltip: "Formula that validates the value. Return true if valid, false if invalid. Use context.mapping for the row data and context.mapping?.[fieldName] for the field value being edited.",
                          },
                          /* wwEditor:end */
                        },
                        message: {
                          label: "Error Message",
                          type: "Text",
                          bindable: true,
                          /* wwEditor:start */
                          bindingValidation: {
                            type: "string",
                            tooltip: "Optional custom error message to display when validation fails",
                          },
                          propertyHelp: {
                            tooltip: "Optional custom error message. If not provided, a default message will be used.",
                          },
                          /* wwEditor:end */
                        },
                      },
                    },
                  },
                },
                defaultValue: [],
                /* wwEditor:start */
                bindingValidation: {
                  type: "array",
                  tooltip: "Array of validation rules to apply to the cell editor",
                },
                propertyHelp: {
                  tooltip: "Define validation rules for this column. Rules are checked when editing ends. The validation mode determines how invalid values are handled.",
                },
                /* wwEditor:end */
              },
              actionName: {
                label: "Action Name",
                type: "Text",
                hidden: array?.item?.cellDataType !== "action",
              },
              actionLabel: {
                label: "Action Label",
                type: "Text",
                hidden: array?.item?.cellDataType !== "action",
              },
              imageWidth: {
                label: "Image width",
                type: "Length",
                options: {
                  noRange: true,
                },
                hidden: array?.item?.cellDataType !== "image",
              },
              imageHeight: {
                label: "Image height",
                type: "Length",
                options: {
                  noRange: true,
                },
                hidden: array?.item?.cellDataType !== "image",
              },
              options: {
                label: "Options",
                type: "Array",
                bindable: true,
                hidden: array?.item?.cellDataType !== "select",
                options: {
                  expandable: true,
                  getItemLabel(item) {
                    return item?.label || item?.value || "Option";
                  },
                  item: {
                    type: "Object",
                    defaultValue: { value: "", label: "", color: "#f0f0f0" },
                    options: {
                      item: {
                        value: {
                          label: "Value",
                          type: "Text",
                        },
                        label: {
                          label: "Label",
                          type: "Text",
                        },
                        color: {
                          label: "Color",
                          type: "Color",
                        },
                      },
                    },
                  },
                },
                /* wwEditor:start */
                bindingValidation: {
                  type: "array",
                  tooltip: "Array of options with value, label, and color",
                },
                /* wwEditor:end */
              },
              optionsValueFormula: {
                label: "Value Field",
                type: "Formula",
                hidden: (content, sidepanelContent, boundProps, wwProps, array) =>
                  array?.item?.cellDataType !== "select" ||
                  !Array.isArray(array?.item?.options) ||
                  !array?.item?.options?.length ||
                  !boundProps?.["columns." + wwProps?.index + ".options"],
                options: (content, sidePanelContent, boundProps, wwProps, array) => ({
                  template:
                    Array.isArray(array?.item?.options) && array?.item?.options.length > 0
                      ? array.item.options[0]
                      : null,
                }),
                defaultValue: {
                  type: "f",
                  code: "context.mapping?.['value']",
                },
              },
              optionsLabelFormula: {
                label: "Label Field",
                type: "Formula",
                hidden: (content, sidepanelContent, boundProps, wwProps, array) =>
                  array?.item?.cellDataType !== "select" ||
                  !Array.isArray(array?.item?.options) ||
                  !array?.item?.options?.length ||
                  !boundProps?.["columns." + wwProps?.index + ".options"],
                options: (content, sidePanelContent, boundProps, wwProps, array) => ({
                  template:
                    Array.isArray(array?.item?.options) && array?.item?.options.length > 0
                      ? array.item.options[0]
                      : null,
                }),
                defaultValue: {
                  type: "f",
                  code: "context.mapping?.['label']",
                },
              },
              optionsColorFormula: {
                label: "Color Field",
                type: "Formula",
                hidden: (content, sidepanelContent, boundProps, wwProps, array) =>
                  array?.item?.cellDataType !== "select" ||
                  !Array.isArray(array?.item?.options) ||
                  !array?.item?.options?.length ||
                  !boundProps?.["columns." + wwProps?.index + ".options"],
                options: (content, sidePanelContent, boundProps, wwProps, array) => ({
                  template:
                    Array.isArray(array?.item?.options) && array?.item?.options.length > 0
                      ? array.item.options[0]
                      : null,
                }),
                defaultValue: {
                  type: "f",
                  code: "context.mapping?.['color']",
                },
              },
              users: {
                label: "Users",
                type: "Array",
                bindable: true,
                hidden: array?.item?.cellDataType !== "user",
                options: {
                  expandable: true,
                  getItemLabel(item) {
                    return item?.name || item?.firstname || item?.lastname || item?.email || "User";
                  },
                  item: {
                    type: "Object",
                    options: {
                      useSchema: true,
                    },
                  },
                },
                /* wwEditor:start */
                bindingValidation: {
                  type: "array",
                  tooltip: "Array of user objects with id, avatar_url, name, firstname, lastname, email, phone, bio, etc.",
                },
                /* wwEditor:end */
              },
              maxNumberOfUsers: {
                label: "Max Number of Users",
                type: "Number",
                hidden: array?.item?.cellDataType !== "user",
                bindable: true,
                options: {
                  min: 1,
                  max: 100,
                  step: 1,
                  noRange: true,
                  defaultValue: 4,
                },
                defaultValue: 4,
                /* wwEditor:start */
                bindingValidation: {
                  type: "number",
                  tooltip: "Maximum number of users that can be selected. If 1, stores a string ID. If > 1, stores an array of IDs.",
                },
                /* wwEditor:end */
              },
              userColumnType: {
                label: "User Column Type",
                type: "TextSelect",
                hidden: array?.item?.cellDataType !== "user",
                bindable: true,
                options: {
                  options: [
                    { value: "directFK", label: "Direct Foreign Key", default: true },
                    { value: "jsonbArray", label: "JSONB Array" },
                    { value: "manyToMany", label: "Many-to-Many" },
                  ],
                },
                defaultValue: "directFK",
                /* wwEditor:start */
                bindingValidation: {
                  type: "string",
                  enum: ["directFK", "jsonbArray", "manyToMany"],
                  tooltip: "Type of user column: 'directFK' for direct foreign key (uses eq/in), 'jsonbArray' for Supabase JSONB arrays (uses contains), 'manyToMany' for junction table relationships (uses eq/in with supabaseFilterField).",
                },
                propertyHelp: {
                  tooltip: "Select the type of user column:\n- Direct Foreign Key: Simple foreign key relationship, uses eq/in operators\n- JSONB Array: Supabase JSONB array column, uses contains operator\n- Many-to-Many: Junction table relationship, uses eq/in with custom filter field (e.g., case_owners.profile.id)",
                },
                /* wwEditor:end */
              },
              userIdFormula: {
                label: "User ID Formula",
                type: "Formula",
                hidden: (content, sidePanelContent, boundProperties, wwProps, array) => 
                  array?.item?.cellDataType !== "user" || array?.item?.userColumnType !== "manyToMany",
                options: (content) => {
                  // Get a sample row from rowData for template
                  const rowData = content?.rowData;
                  const sampleRow = Array.isArray(rowData) && rowData.length > 0 ? rowData[0] : null;
                  const fieldValue = sampleRow?.[array?.item?.field];
                  
                  return {
                    template: fieldValue || null,
                  };
                },
                defaultValue: {
                  type: 'f',
                  code: "context.mapping",
                },
                /* wwEditor:start */
                bindingValidation: {
                  type: 'any',
                  tooltip: 'Formula to extract user ID(s) from the cell value. Can return a single ID or an array of IDs.',
                },
                propertyHelp: {
                  label: 'Formula to extract user ID(s) from the cell value',
                  description: 'By default, uses the cell value directly (context.mapping). Use this if user IDs are nested in objects or arrays. The formula should return either a single user ID or an array of user IDs.',
                },
                /* wwEditor:end */
              },
            },
            propertiesOrder: [
              "headerName",
              "field",
              "cellDataType",
              "info",
              "dateFormat",
              "timeFormat",
              "currencyMode",
              "currencyCode",
              "currencyCodeField",
              "customFilterType",
              "actionName",
              "actionLabel",
              "imageWidth",
              "imageHeight",
              "options",
              "optionsValueFormula",
              "optionsLabelFormula",
              "optionsColorFormula",
              "users",
              "maxNumberOfUsers",
              "userColumnType",
              "userIdFormula",
              "useCustomLabel",
              "displayLabelFormula",
              "useDisplayValueForFilterSort",
              {
                label: "Width",
                isCollapsible: true,
                properties: [
                  "widthAlgo",
                  "flex",
                  "width",
                  "minWidth",
                  "maxWidth",
                ],
              },
              {
                label: "Configuration",
                isCollapsible: true,
                properties: [
                  "pinned",
                  "hide",
                  "editable",
                  "isDirectUpdate",
                  "filter",
                  "sortable",
                  "suppressRowInteraction",
                  "validation",
                ],
              },
            ],
          }),
        },
        defaultValue: {
          filter: false,
          sortable: false,
        },
        movable: true,
        expandable: true,
        getItemLabel(item, index) {
          return item?.headerName?.length
            ? item?.headerName
            : item?.field?.length
              ? item?.field
              : `Column ${index + 1}`;
        },
      },
      defaultValue: [],
      section: "settings",
      bindable: true,
    },
    pagination: {
      label: { en: "Pagination" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      defaultValue: false,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "Enable or disable pagination",
      },
      /* wwEditor:end */
    },
    hasPaginationSelector: {
      label: { en: "Rows Per Page" },
      type: "TextSelect",
      section: "settings",
      bindable: true,
      options: {
        options: [
          { value: "single", label: "Single", default: true },
          { value: "multiple", label: "Multiple" },
        ],
      },
      /* wwEditor:start */
      hidden: (content) => !content.pagination,
      bindingValidation: {
        type: "string",
        enum: ["single", "multiple"],
        tooltip: "Type of pagination (single or multiple)",
      },
      /* wwEditor:end */
    },
    paginationPageSize: {
      type: "Number",
      section: "settings",
      bindable: true,
      defaultValue: 10,
      options: {
        noRange: true,
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "number",
        tooltip: "Number of rows to display per page",
      },
      hidden: (content) =>
        !content.pagination || content.hasPaginationSelector === "multiple",
      /* wwEditor:end */
    },
    paginationPageSizeSelector: {
      type: "RawObject",
      section: "settings",
      bindable: true,
      options: {
        placeholder: "[10, 20, 50, 100]",
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "Array",
        tooltip: "Array of number of rows to display per page",
      },
      hidden: (content) =>
        !content.pagination ||
        !content.hasPaginationSelector ||
        content.hasPaginationSelector === "single",
      /* wwEditor:end */
    },
    rowSelection: {
      label: { en: "Row Selection" },
      type: "TextSelect",
      section: "settings",
      bindable: true,
      options: {
        options: [
          { value: "none", label: "None", default: true },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        tooltip: "Type of row selection: none or single or multiple",
      },
      /* wwEditor:end */
    },
    enableClickSelection: {
      label: { en: "Enable Click Selection" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "True to enable row selection on click",
      },
      hidden: (content) =>
        content.rowSelection === "none" || content.rowSelection === undefined,
      /* wwEditor:end */
    },
    disableCheckboxes: {
      label: { en: "Disable Checkboxes" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      defaultValue: false,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "True to disable checkboxes",
      },
      hidden: (content) =>
        content.rowSelection === "none" || content.rowSelection === undefined,
      /* wwEditor:end */
    },
    selectAll: {
      label: { en: "Select All behavior" },
      type: "TextSelect",
      section: "settings",
      bindable: true,
      defaultValue: "all",
      options: {
        options: [
          { value: "all", label: "All", default: true },
          { value: "filtered", label: "Filtered" },
          { value: "currentPage", label: "Current Page" },
        ],
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        enum: ["all", "filtered", "currentPage"],
        tooltip:
          "Select all behavior: 'all' to select all rows, 'filtered' to select filtered rows, 'currentPage' to select current page rows",
      },
      hidden: (content) => content.rowSelection !== "multiple",
      /* wwEditor:end */
    },
    movableColumns: {
      label: { en: "Movable Columns" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "Enable or disable movable columns",
      },
      /* wwEditor:end */
    },
    resizableColumns: {
      label: { en: "Resizable Columns" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      defaultValue: true,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "Enable or disable resizable columns",
      },
      /* wwEditor:end */
    },
    invalidEditValueMode: {
      label: { en: "Validation Mode" },
      type: "TextSelect",
      section: "settings",
      bindable: true,
      defaultValue: "revert",
      options: {
        options: [
          { value: "revert", label: "Revert", default: true },
          { value: "block", label: "Block" },
        ],
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        enum: ["revert", "block"],
        tooltip: "Validation mode: 'revert' cancels invalid edits and reverts to original value, 'block' prevents editor from closing until valid value is provided",
      },
      propertyHelp: {
        tooltip: "Controls how invalid cell edits are handled. 'Revert' mode cancels the edit and reverts to the original value. 'Block' mode prevents the editor from closing until a valid value is provided.",
      },
      /* wwEditor:end */
    },
    cellEditMode: {
      label: { en: "Edit Mode" },
      type: "TextSelect",
      section: "settings",
      bindable: true,
      defaultValue: "singleClick",
      options: {
        options: [
          { value: "singleClick", label: "Single Click", default: true },
          { value: "doubleClick", label: "Double Click" },
        ],
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        enum: ["singleClick", "doubleClick"],
        tooltip: "Edit mode: 'singleClick' enables editing with a single click, 'doubleClick' requires double-click to edit",
      },
      propertyHelp: {
        tooltip: "Controls how cell editing is triggered. 'Single Click' allows editing cells with a single click. 'Double Click' requires double-clicking a cell to start editing.",
      },
      /* wwEditor:end */
    },
    initialFilters: {
      label: { en: "Initial Filters" },
      type: "RawObject",
      section: "settings",
      bindable: true,
      defaultValue: null,
      bindingValidation: {
        type: "object",
        tooltip: "An object representing the initial filter model",
      },
    },
    initialSort: {
      label: { en: "Initial Sort" },
      type: "RawObject",
      section: "settings",
      bindable: true,
      defaultValue: null,
      bindingValidation: {
        type: "array",
        tooltip: "An array representing the initial sort model",
      },
    },
    initialColumnsOrder: {
      label: { en: "Initial Columns Order" },
      type: "RawObject",
      section: "settings",
      bindable: true,
      defaultValue: null,
      bindingValidation: {
        type: "array",
        tooltip: "An array representing the id of the initial columns order",
      },
    },
    lang: {
      label: { en: "Language" },
      type: "TextSelect",
      section: "settings",
      bindable: true,
      options: {
        options: [
          { value: "en", label: "English", default: true },
          { value: "fr", label: "French" },
          { value: "es", label: "Spanish" },
          { value: "de", label: "German" },
          { value: "pt", label: "Portuguese" },
          { value: "custom", label: "Custom" },
        ],
      },
      /* wwEditor:start */
      bindingValidation: {
        type: "string",
        tooltip:
          "Localisation to use. Default is English. Possible values: en, fr, es, de, pt, custom. Use custom to set your own locale texts.",
      },
      /* wwEditor:end */
    },
    localeText: {
      label: { en: "Locale texts" },
      type: "RawObject",
      section: "settings",
      bindable: true,
      defaultValue: {},
      hidden: (content) => content.lang !== "custom",
      /* wwEditor:start */
      bindingValidation: {
        type: "object",
        tooltip:
          'See <a href="https://github.com/ag-grid/ag-grid/blob/latest/community-modules/locale/src/en-US.ts" target="_blank">Aggrid website</a> for the list of texts to localise',
      },
      /* wwEditor:end */
    },
    wrapperBorderRadius: {
      label: { en: "Border Radius" },
      type: "Length",
      options: {
        noRange: true,
      },
      bindable: true,
      responsive: true,
      states: true,
      classes: true,
    },
    rowReorder: {
      label: { en: "Row Reorder" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      defaultValue: false,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "Enable or disable row reordering",
      },
      /* wwEditor:end */
    },
    reorderInfoBox: {
      type: "InfoBox",
      section: "settings",
      editorOnly: true,
      hidden: (content) => !(content.rowReorder && content.pagination),
      options: {
        variant: "warning",
        icon: "warning",
        title: "Incompatible options",
        content: `Row reordering is not compatible with pagination. Pagination will be disabled`,
      },
    },
    enableDebugLogs: {
      label: { en: "Enable Debug Logs" },
      type: "OnOff",
      section: "settings",
      bindable: true,
      defaultValue: false,
      /* wwEditor:start */
      bindingValidation: {
        type: "boolean",
        tooltip: "Enable or disable debug console logs for validation and debugging purposes",
      },
      propertyHelp: {
        tooltip: "When enabled, detailed debug information will be logged to the browser console. Useful for troubleshooting validation issues and understanding component behavior.",
      },
      /* wwEditor:end */
    },
  },
};
