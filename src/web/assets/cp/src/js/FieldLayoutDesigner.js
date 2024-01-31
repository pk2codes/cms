/** global: Craft */
import $ from 'jquery';

/** global: Garnish */
Craft.FieldLayoutDesigner = Garnish.Base.extend(
  {
    $container: null,
    $configInput: null,
    $tabContainer: null,
    $newTabBtn: null,
    $sidebar: null,
    $selectedLibrary: null,
    $fieldLibrary: null,
    $uiLibrary: null,
    $uiLibraryElements: null,
    $fieldSearch: null,
    $clearFieldSearchBtn: null,
    $fieldGroups: null,
    $fields: null,
    $createFieldBtn: null,

    tabGrid: null,
    elementDrag: null,

    _config: null,
    _$selectedFields: null,

    init: function (container, settings) {
      this.$container = $(container);
      this.setSettings(settings, Craft.FieldLayoutDesigner.defaults);

      this.$configInput = this.$container.children('input[data-config-input]');
      this._config = JSON.parse(this.$configInput.val());
      if (!this._config.tabs) {
        this._config.tabs = [];
      }

      this._fieldHandles = {};

      let $workspace = this.$container.children('.fld-workspace');
      this.$tabContainer = $workspace.children('.fld-tabs');
      this.$newTabBtn = $workspace.children('.fld-new-tab-btn');
      this.$sidebar = this.$container.children('.fld-sidebar');

      this.$fieldLibrary = this.$selectedLibrary =
        this.$sidebar.children('.fld-field-library');
      let $fieldSearchContainer = this.$fieldLibrary.children('.search');
      this.$fieldSearch = $fieldSearchContainer.children('input');
      this.$clearFieldSearchBtn = $fieldSearchContainer.children('.clear');
      this.$fieldGroups = this.$sidebar.find('.fld-field-group');
      this.$fields = this.$fieldGroups.children('.fld-element');
      this.$uiLibrary = this.$sidebar.children('.fld-ui-library');
      this.$uiLibraryElements = this.$uiLibrary.children();

      // Set up the layout grids
      this.tabGrid = new Craft.Grid(this.$tabContainer, {
        itemSelector: '.fld-tab',
        minColWidth: 24 * 11,
        fillMode: 'grid',
        snapToGrid: 24,
      });

      let $tabs = this.$tabContainer.children();
      for (let i = 0; i < $tabs.length; i++) {
        this.initTab($($tabs[i]));
      }

      this.elementDrag = new Craft.FieldLayoutDesigner.ElementDrag(this);

      if (this.settings.customizableTabs) {
        this.tabDrag = new Craft.FieldLayoutDesigner.TabDrag(this);

        this.addListener(this.$newTabBtn, 'activate', 'addTab');
      }

      // Set up the sidebar
      if (this.settings.customizableUi) {
        const $libraryPicker = this.$sidebar.children('.btngroup');
        new Craft.Listbox($libraryPicker, {
          onChange: ($selectedOption) => {
            const library = $selectedOption.data('library');
            switch (library) {
              case 'field':
                this.$fieldLibrary.removeClass('hidden');
                this.$uiLibrary.addClass('hidden');
                this.$createFieldBtn.removeClass('hidden');
                break;
              case 'ui':
                this.$fieldLibrary.addClass('hidden');
                this.$uiLibrary.removeClass('hidden');
                this.$createFieldBtn.addClass('hidden');
                break;
            }
          },
        });
      }

      this.addListener(this.$fieldSearch, 'input', () => {
        this.updateFieldSearchResults();
      });

      this.addListener(this.$fieldSearch, 'keydown', (ev) => {
        switch (ev.keyCode) {
          case Garnish.ESC_KEY:
            this.$fieldSearch.val('').trigger('input');
            break;
          case Garnish.RETURN_KEY:
            // they most likely don't want to submit the form from here
            ev.preventDefault();
            break;
        }
      });

      // Clear the search when the X button is clicked
      this.addListener(this.$clearFieldSearchBtn, 'click', () => {
        this.$fieldSearch.val('').trigger('input');
      });

      this.refreshSelectedFields();

      // Add the “New Field” button
      this.$createFieldBtn = Craft.ui
        .createButton({
          label: Craft.t('app', 'New field'),
          class: 'mt-m fullwidth add icon dashed',
        })
        .appendTo(this.$sidebar);

      this.addListener(this.$createFieldBtn, 'activate', async () => {
        this.createField();
      });
    },

    updateFieldSearchResults() {
      const val = this.$fieldSearch.val().toLowerCase().replace(/['"]/g, '');
      if (!val) {
        this.$fieldLibrary.find('.filtered').removeClass('filtered');
        this.$clearFieldSearchBtn.addClass('hidden');
        return;
      }

      this.$clearFieldSearchBtn.removeClass('hidden');
      const $matches = this.$fields
        .filter(`[data-keywords*="${val}"]`)
        .add(
          this.$fieldGroups
            .filter(`[data-name*="${val}"]`)
            .children('.fld-element')
        )
        .removeClass('filtered');
      this.$fields.not($matches).addClass('filtered');

      // hide any groups that don't have any results
      for (let i = 0; i < this.$fieldGroups.length; i++) {
        const $group = this.$fieldGroups.eq(i);
        if ($group.find('.fld-element:not(.hidden):not(.filtered)').length) {
          $group.removeClass('filtered');
        } else {
          $group.addClass('filtered');
        }
      }
    },

    initTab: function ($tab) {
      return new Craft.FieldLayoutDesigner.Tab(this, $tab);
    },

    removeFieldByHandle: function (attribute) {
      this.$fields
        .filter(`[data-attribute="${attribute}"]:first`)
        .removeClass('hidden')
        .closest('.fld-field-group')
        .removeClass('hidden');
    },

    addTab: function () {
      if (!this.settings.customizableTabs) {
        return;
      }

      let defaultValue = '';
      if (this.tabGrid.$items.length === 0) {
        defaultValue = Craft.t('app', 'Content');
      }
      const name = Craft.escapeHtml(
        prompt(Craft.t('app', 'Give your tab a name.'), defaultValue)
      );

      if (!name) {
        return;
      }

      const $tab = $(`
<div class="fld-tab">
  <div class="tabs">
    <div class="tab sel draggable">
      <span>${name}</span>
    </div>
  </div>
  <div class="fld-tabcontent"></div>
</div>
`);
      // keep it before the resize object
      const $lastTab = this.$tabContainer.children('.fld-tab:last');
      if ($lastTab.length) {
        $tab.insertAfter($lastTab);
      } else {
        $tab.prependTo(this.$tabContainer);
      }

      this.tabGrid.addItems($tab);
      this.tabDrag.addItems($tab);

      const tab = this.initTab($tab);
      tab.updatePositionInConfig();
    },

    get config() {
      return this._config;
    },

    set config(config) {
      this._config = config;
      this.$configInput.val(JSON.stringify(config));
    },

    updateConfig: function (callback) {
      const config = callback(this.config);
      if (config !== false) {
        this.config = config;
      }
    },

    refreshSelectedFields: function () {
      this._$selectedFields = this.$tabContainer.find('.fld-field');
    },

    refreshLibraryFields() {
      this.$fields = this.$fieldGroups.children('.fld-element');

      for (let i = 0; i < this.$fieldGroups.length; i++) {
        const $fieldGroup = this.$fieldGroups.eq(i);
        const $fields = $fieldGroup.children('.fld-element');
        $fields
          .sort((a, b) => {
            return $(a).data('ui-label') > $(b).data('ui-label') ? 1 : -1;
          })
          .appendTo($fieldGroup);
      }

      this.updateFieldSearchResults();
    },

    hasHandle: function (handle) {
      for (let i = 0; i < this._$selectedFields.length; i++) {
        const element = this._$selectedFields.eq(i).data('fld-element');
        const elementHandle = element.config.handle || element.attribute;
        if (handle === elementHandle) {
          return true;
        }
      }

      return false;
    },

    createField() {
      const slideout = new Craft.CpScreenSlideout('fields/edit-field');

      slideout.on('submit', async ({response}) => {
        // add the library selector
        const $selector = $(response.data.selectorHtml);
        this.$fieldGroups.last().append($selector);
        this.refreshLibraryFields();
        this.elementDrag.addItems($selector);

        // refresh all instances of this field
        const $fields = designer.$tabContainer.find(
          `.fld-field[data-id=${this.fieldId}]`
        );
        for (let i = 0; i < $fields.length; i++) {
          $fields.eq(i).data('fld-element')?.refresh();
        }
      });
    },
  },
  {
    defaults: {
      elementType: null,
      customizableTabs: true,
      customizableUi: true,
    },

    async createSlideout(data, js) {
      const $body = $('<div/>', {class: 'fld-element-settings-body'});
      $('<div/>', {class: 'fields', html: data.settingsHtml}).appendTo($body);
      const $footer = $('<div/>', {class: 'fld-element-settings-footer'});
      $('<div/>', {class: 'flex-grow'}).appendTo($footer);
      const $cancelBtn = Craft.ui
        .createButton({
          label: Craft.t('app', 'Close'),
          spinner: true,
        })
        .appendTo($footer);
      Craft.ui
        .createSubmitButton({
          class: 'secondary',
          label: Craft.t('app', 'Apply'),
          spinner: true,
        })
        .appendTo($footer);
      const $contents = $body.add($footer);

      const slideout = new Craft.Slideout($contents, {
        containerElement: 'form',
        containerAttributes: {
          action: '',
          method: 'post',
          novalidate: '',
          class: 'fld-element-settings',
        },
      });
      slideout.on('open', () => {
        // Hold off a sec until it's positioned...
        Garnish.requestAnimationFrame(() => {
          // Focus on the first text input
          slideout.$container.find('.text:first').trigger('focus');
        });
      });

      $cancelBtn.on('click', () => {
        slideout.close();
      });

      if (data.headHtml) {
        await Craft.appendHeadHtml(data.headHtml);
      }
      if (data.bodyHtml) {
        await Craft.appendBodyHtml(data.bodyHtml);
      }
      if (js) {
        eval(js);
      }

      Craft.initUiElements(slideout.$container);

      return slideout;
    },
  }
);

Craft.FieldLayoutDesigner.Tab = Garnish.Base.extend({
  designer: null,
  uid: null,
  $container: null,
  slideout: null,
  destroyed: false,

  init: function (designer, $container) {
    this.designer = designer;
    this.$container = $container;
    this.$container.data('fld-tab', this);
    this.uid = this.$container.data('uid');

    // New tab?
    if (!this.uid) {
      this.uid = Craft.uuid();
      this.config = {
        uid: this.uid,
        name: this.$container.find('.tabs .tab span').text(),
        elements: [],
      };
      this.$container.data(
        'settings-namespace',
        this.designer.$container
          .data('new-tab-settings-namespace')
          .replace(/\bTAB_UID\b/g, this.uid)
      );
      this.$container.data(
        'settings-html',
        this.designer.$container
          .data('new-tab-settings-html')
          .replace(/\bTAB_UID\b/g, this.uid)
          .replace(/\bTAB_NAME\b/g, this.config.name)
      );
      this.$container.data(
        'settings-js',
        this.designer.$container
          .data('new-tab-settings-js')
          .replace(/\bTAB_UID\b/g, this.uid)
      );
    }

    if (this.designer.settings.customizableTabs) {
      this.settingsNamespace = this.$container.data('settings-namespace');
      this.createMenu();
    }

    // initialize the elements
    const $elements = this.$container.children('.fld-tabcontent').children();

    for (let i = 0; i < $elements.length; i++) {
      this.initElement($($elements[i]));
    }
  },

  createMenu: function () {
    const $tab = this.$container.find('.tabs .tab');
    const menuId = `actionmenu${Math.floor(Math.random() * 1000000)}`;
    const $btn = $('<button/>', {
      type: 'button',
      class: 'btn action-btn',
      'data-disclosure-trigger': 'true',
      'aria-controls': menuId,
      'aria-haspopup': 'true',
      'aria-label': Craft.t('app', 'Actions'),
      title: Craft.t('app', 'Actions'),
    }).appendTo($tab);
    const $menu = $('<div/>', {
      id: menuId,
      class: 'menu menu--disclosure',
      'data-disclosure-menu': 'true',
    }).appendTo($tab);

    const disclosureMenu = $btn.disclosureMenu().data('disclosureMenu');

    disclosureMenu.addItem(
      {
        label: Craft.t('app', 'Settings'),
        icon: 'gear',
        onActivate: () => {
          this.showSettings();
        },
      },
      disclosureMenu.addGroup()
    );

    const moveUl = disclosureMenu.addGroup();
    const moveLeftBtn = disclosureMenu.addItem(
      {
        label:
          Craft.orientation === 'ltr'
            ? Craft.t('app', 'Move to the left')
            : Craft.t('app', 'Move to the right'),
        icon: Craft.orientation === 'ltr' ? 'arrow-left' : 'arrow-right',
        onActivate: () => {
          this.moveLeft();
        },
      },
      moveUl
    );

    const moveRightBtn = disclosureMenu.addItem(
      {
        label:
          Craft.orientation === 'ltr'
            ? Craft.t('app', 'Move to the right')
            : Craft.t('app', 'Move to the left'),
        icon: Craft.orientation === 'ltr' ? 'arrow-right' : 'arrow-left',
        onActivate: () => {
          this.moveRight();
        },
      },
      moveUl
    );

    disclosureMenu.addItem(
      {
        label: Craft.t('app', 'Remove'),
        icon: 'xmark',
        onActivate: () => {
          this.destroy();
        },
      },
      disclosureMenu.addGroup()
    );

    disclosureMenu.on('show', () => {
      if (this.$container.prev('.fld-tab').length) {
        $(moveLeftBtn).parent().removeClass('hidden');
      } else {
        $(moveLeftBtn).parent().addClass('hidden');
      }

      if (this.$container.next('.fld-tab').length) {
        $(moveRightBtn).parent().removeClass('hidden');
      } else {
        $(moveRightBtn).parent().addClass('hidden');
      }

      if (!this.$container.siblings('.fld-tab').length) {
        $(moveUl).prev('hr').addClass('hidden');
      } else {
        $(moveUl).prev('hr').removeClass('hidden');
      }

      disclosureMenu.setContainerPosition();
    });
  },

  async showSettings() {
    if (!this.slideout) {
      await this.createSettings();
    } else {
      this.slideout.open();
    }
  },

  async createSettings() {
    const settingsHtml = this.$container.data('settings-html');
    const settingsJs = this.$container.data('settings-js');
    this.slideout = await Craft.FieldLayoutDesigner.createSlideout(
      {settingsHtml},
      settingsJs
    );

    this.slideout.$container.on('submit', (ev) => {
      ev.preventDefault();
      this.applySettings();
    });
  },

  applySettings: function () {
    if (!this.slideout.$container.find('[name$="[name]"]').val()) {
      Craft.cp.displayError(Craft.t('app', 'You must specify a tab name.'));
      return;
    }

    // update the UI
    let $submitBtn = this.slideout.$container
      .find('button[type=submit]')
      .addClass('loading');

    const config = $.extend({}, this.config);
    delete config.elements;

    Craft.sendActionRequest('POST', 'fields/apply-layout-tab-settings', {
      data: {
        config: config,
        elementType: this.designer.settings.elementType,
        settingsNamespace: this.settingsNamespace,
        settings: this.slideout.$container.serialize(),
      },
    })
      .then((response) => {
        this.updateConfig((config) =>
          $.extend(response.data.config, {elements: config.elements})
        );
        const $label = this.$container.find('.tabs .tab span');
        const $indicator = $label.children('.fld-indicator');
        if (response.data.hasConditions) {
          if (!$indicator.length) {
            $label.append(
              $('<div/>', {
                class: 'fld-indicator',
                title: Craft.t('app', 'This tab is conditional'),
                'aria-label': Craft.t('app', 'This tab is conditional'),
                'data-icon': 'condition',
                role: 'img',
              })
            );
          }
        } else if ($indicator.length) {
          $indicator.remove();
        }
        this.slideout.close();
      })
      .catch((e) => {
        Craft.cp.displayError();
        console.error(e);
      })
      .finally(() => {
        $submitBtn.removeClass('loading');
        this.slideout.close();
      });
  },

  moveLeft() {
    let $prev = this.$container.prev('.fld-tab');
    if ($prev.length) {
      this.$container.insertBefore($prev);
      this.updatePositionInConfig();
    }
  },

  moveRight() {
    let $next = this.$container.next('.fld-tab');
    if ($next.length) {
      this.$container.insertAfter($next);
      this.updatePositionInConfig();
    }
  },

  initElement: function ($element) {
    return new Craft.FieldLayoutDesigner.Element(this, $element);
  },

  get index() {
    return this.designer.config.tabs.findIndex((c) => c.uid === this.uid);
  },

  get config() {
    if (!this.uid) {
      throw 'Tab is missing its UID';
    }
    let config = this.designer.config.tabs.find((c) => c.uid === this.uid);
    if (!config) {
      config = {
        uid: this.uid,
        elements: [],
      };
      this.config = config;
    }
    return config;
  },

  set config(config) {
    if (this.destroyed) {
      return;
    }

    // Is the name changing?
    if (config.name && config.name !== this.config.name) {
      this.$container.find('.tabs .tab span').text(config.name);
    }

    const designerConfig = this.designer.config;
    const index = this.index;
    if (index !== -1) {
      designerConfig.tabs[index] = config;
    } else {
      const newIndex = $.inArray(
        this.$container[0],
        this.$container.parent().children('.fld-tab')
      );
      designerConfig.tabs.splice(newIndex, 0, config);
    }
    this.designer.config = designerConfig;
  },

  updateConfig: function (callback) {
    if (this.destroyed) {
      return;
    }

    const config = callback(this.config);
    if (config !== false) {
      this.config = config;
    }
  },

  updatePositionInConfig: function () {
    if (this.destroyed) {
      return;
    }

    this.designer.updateConfig((config) => {
      const tabConfig = this.config;
      const oldIndex = this.index;
      const newIndex = $.inArray(
        this.$container[0],
        this.$container.parent().children('.fld-tab')
      );
      if (oldIndex !== -1) {
        config.tabs.splice(oldIndex, 1);
      }
      config.tabs.splice(newIndex, 0, tabConfig);
      return config;
    });
  },

  destroy: function () {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.designer.updateConfig((config) => {
      const index = this.index;
      if (index === -1) {
        return false;
      }
      config.tabs.splice(index, 1);
      return config;
    });

    // First destroy the tab's elements
    let $elements = this.$container.find('.fld-element');
    for (let i = 0; i < $elements.length; i++) {
      $elements.eq(i).data('fld-element').destroy();
    }

    this.designer.tabGrid.removeItems(this.$container);
    this.designer.tabDrag.removeItems(this.$container);
    this.$container.remove();
    this.designer.refreshSelectedFields();

    this.base();
  },
});

Craft.FieldLayoutDesigner.Element = Garnish.Base.extend({
  tab: null,
  $container: null,

  uid: null,
  isMandatory: false,
  isMultiInstance: null,
  isField: false,
  attribute: null,
  requirable: false,
  thumbable: false,
  previewable: false,
  hasCustomWidth: false,
  hasSettings: false,
  settingsNamespace: null,
  slideout: null,
  defaultHandle: null,
  fieldId: null,

  init: function (tab, $container) {
    this.tab = tab;
    this.$container = $container;
    this.uid = $container.data('uid');
    this.fieldId = $container.data('id');

    // New element?
    const isNew = !this.uid;
    if (isNew) {
      this.uid = Craft.uuid();
      this.config = $.extend($container.data('config'), {uid: this.uid});
    }

    this.initUi();

    if (isNew && this.isField) {
      // Find a unique handle
      let handle = this.defaultHandle;
      let i = 1;
      while (this.tab.designer.hasHandle(handle)) {
        i++;
        handle = this.defaultHandle + i;
      }
      if (handle !== this.defaultHandle) {
        this.config = $.extend({}, this.config, {handle: handle});
        $container.find('.fld-attribute-label').text(handle);
      }
      this.tab.designer.refreshSelectedFields();
    }

    // cleanup
    $container.attr('data-keywords', null);
    $container.attr('data-settings-html', null);
  },

  initUi: function () {
    this.$container.data('fld-element', this);

    this.isMandatory = Garnish.hasAttr(this.$container, 'data-mandatory');
    this.isField = this.$container.hasClass('fld-field');
    this.isMultiInstance = Garnish.hasAttr(
      this.$container,
      'data-is-multi-instance'
    );

    if (this.isField) {
      this.requirable = Garnish.hasAttr(this.$container, 'data-requirable');
      this.thumbable = Garnish.hasAttr(this.$container, 'data-thumbable');
      this.previewable = Garnish.hasAttr(this.$container, 'data-previewable');
      this.attribute = this.$container.data('attribute');
      this.defaultHandle = this.$container.data('default-handle');
    }

    this.hasCustomWidth =
      this.tab.designer.settings.customizableUi &&
      Garnish.hasAttr(this.$container, 'data-has-custom-width');

    if (this.hasCustomWidth) {
      let widthSlider = new Craft.SlidePicker(this.config.width || 100, {
        min: 25,
        max: 100,
        step: 25,
        valueLabel: (width) => {
          return Craft.t('app', '{pct} width', {pct: `${width}%`});
        },
        onChange: (width) => {
          this.updateConfig((config) => {
            config.width = width;
            return config;
          });
        },
      });
      widthSlider.$container.appendTo(this.$container);
    }

    // create the action menu
    const menuId = `actionmenu${Math.floor(Math.random() * 1000000)}`;
    const $actionBtn = $('<button/>', {
      type: 'button',
      class: 'btn action-btn',
      'data-disclosure-trigger': 'true',
      'aria-controls': menuId,
      'aria-haspopup': 'true',
      'aria-label': Craft.t('app', 'Actions'),
      title: Craft.t('app', 'Actions'),
    }).appendTo(this.$container);
    $('<div/>', {
      id: menuId,
      class: 'menu menu--disclosure',
      'data-disclosure-menu': 'true',
    }).appendTo(this.$container);
    const disclosureMenu = $actionBtn.disclosureMenu().data('disclosureMenu');

    let makeRequiredBtn,
      dropRequiredBtn,
      makeThumbnailBtn,
      dropThumbnailBtn,
      showInCardsBtn,
      omitFromCardsBtn;

    this.hasSettings = Garnish.hasAttr(this.$container, 'data-has-settings');

    if (this.hasSettings) {
      disclosureMenu.addItem({
        label: Craft.t('app', 'Settings'),
        icon: 'gear',
        onActivate: () => {
          this.showSettings();
        },
      });

      this.addListener(this.$container, 'dblclick', () => {
        this.showSettings();
      });
    }

    if (this.fieldId) {
      disclosureMenu.addItem({
        label: Craft.t('app', 'Edit field'),
        icon: 'pencil',
        onActivate: () => {
          this.showFieldEditor();
        },
      });
    }

    if (this.requirable || this.thumbable || this.previewable) {
      const actionUl = disclosureMenu.addGroup();

      if (this.requirable) {
        makeRequiredBtn = disclosureMenu.addItem(
          {
            label: Craft.t('app', 'Make required'),
            icon: 'asterisk',
            iconColor: 'rose',
            onActivate: () => {
              this.makeRequired();
            },
          },
          actionUl
        );

        dropRequiredBtn = disclosureMenu.addItem(
          {
            label: Craft.t('app', 'Make optional'),
            icon: 'asterisk-slash',
            iconColor: 'gray',
            onActivate: () => {
              this.dropRequired();
            },
          },
          actionUl
        );
      }

      if (this.thumbable) {
        makeThumbnailBtn = disclosureMenu.addItem(
          {
            label: Craft.t('app', 'Use for element thumbnails'),
            icon: 'image',
            iconColor: 'violet',
            onActivate: () => {
              this.makeThumbnail();
            },
          },
          actionUl
        );
        dropThumbnailBtn = disclosureMenu.addItem(
          {
            label: Craft.t('app', 'Don’t use for element thumbnails'),
            icon: 'image-slash',
            iconColor: 'gray',
            onActivate: () => {
              this.dropThumbnail();
            },
          },
          actionUl
        );
      }

      if (this.previewable) {
        showInCardsBtn = disclosureMenu.addItem(
          {
            label: Craft.t('app', 'Show in element cards'),
            icon: 'eye',
            iconColor: 'blue',
            onActivate: () => {
              this.showInCards();
            },
          },
          actionUl
        );
        omitFromCardsBtn = disclosureMenu.addItem(
          {
            label: Craft.t('app', 'Don’t show in element cards'),
            icon: 'eye-slash',
            iconColor: 'gray',
            onActivate: () => {
              this.omitFromCards();
            },
          },
          actionUl
        );
      }
    }

    const moveGroup = disclosureMenu.addGroup();
    const moveUpBtn = disclosureMenu.addItem(
      {
        label: Craft.t('app', 'Move up'),
        icon: 'arrow-up',
        onActivate: () => {
          this.moveUp();
        },
      },
      moveGroup
    );
    const moveDownBtn = disclosureMenu.addItem(
      {
        label: Craft.t('app', 'Move down'),
        icon: 'arrow-down',
        onActivate: () => {
          this.moveDown();
        },
      },
      moveGroup
    );

    if (!this.isMandatory) {
      disclosureMenu.addItem(
        {
          label: Craft.t('app', 'Remove'),
          icon: 'xmark',
          destructive: true,
          onActivate: () => {
            this.destroy();
          },
        },
        disclosureMenu.addGroup()
      );
    }

    disclosureMenu.on('show', () => {
      if (this.config.required) {
        $(makeRequiredBtn).parent().addClass('hidden');
        $(dropRequiredBtn).parent().removeClass('hidden');
      } else {
        $(makeRequiredBtn).parent().removeClass('hidden');
        $(dropRequiredBtn).parent().addClass('hidden');
      }

      if (this.config.providesThumbs) {
        $(makeThumbnailBtn).parent().addClass('hidden');
        $(dropThumbnailBtn).parent().removeClass('hidden');
      } else {
        $(makeThumbnailBtn).parent().removeClass('hidden');
        $(dropThumbnailBtn).parent().addClass('hidden');
      }

      if (this.config.includeInCards) {
        $(showInCardsBtn).parent().addClass('hidden');
        $(omitFromCardsBtn).parent().removeClass('hidden');
      } else {
        $(showInCardsBtn).parent().removeClass('hidden');
        $(omitFromCardsBtn).parent().addClass('hidden');
      }

      const $prev = this.$container.prev('.fld-element');
      const $next = this.$container.next('.fld-element');

      if ($prev.length) {
        $(moveUpBtn).parent().removeClass('hidden');
      } else {
        $(moveUpBtn).parent().addClass('hidden');
      }

      if ($next.length) {
        $(moveDownBtn).parent().removeClass('hidden');
      } else {
        $(moveDownBtn).parent().addClass('hidden');
      }

      disclosureMenu.setContainerPosition();
    });
  },

  async showSettings() {
    if (!this.slideout) {
      await this.createSettings();
    } else {
      this.slideout.open();
    }
  },

  async createSettings() {
    let data;
    try {
      const response = await Craft.sendActionRequest(
        'POST',
        'fields/render-layout-element-settings',
        {
          data: {
            config: this.config,
            elementType: this.tab.designer.settings.elementType,
          },
        }
      );
      data = response.data;
    } catch (e) {
      Craft.cp.displayError(e?.response?.data?.message);
      throw e;
    }

    this.settingsNamespace = data.namespace;
    this.slideout = await Craft.FieldLayoutDesigner.createSlideout(data);

    this.slideout.$container.on('submit', (ev) => {
      ev.preventDefault();
      this.applySettings();
    });

    const $fieldsContainer = this.slideout.$container.find('.fields:first');

    if (this.isField) {
      const $handleInput = $fieldsContainer.find('input[name$="[handle]"]');
      $handleInput.val(this.config.handle || '');
    }

    this.trigger('createSettings');
  },

  async applySettings() {
    // update the UI
    let $submitBtn = this.slideout.$container
      .find('button[type=submit]')
      .addClass('loading');

    try {
      await this.applyConfig(() => this.config, true);
    } finally {
      $submitBtn.removeClass('loading');
    }
  },

  async showFieldEditor() {
    const slideout = new Craft.CpScreenSlideout('fields/edit-field', {
      params: {
        fieldId: this.fieldId,
        multiInstanceTypesOnly: this.isMultiInstance ? 1 : 0,
      },
    });

    slideout.on('submit', async ({response}) => {
      const designer = this.tab.designer;

      // refresh the library selector
      const $oldSelector = designer.$fieldLibrary.find(
        `.fld-field[data-id=${this.fieldId}]`
      );
      const $newSelector = $(response.data.selectorHtml);
      $oldSelector.replaceWith($newSelector);
      designer.refreshLibraryFields();
      designer.elementDrag.removeItems($oldSelector);
      designer.elementDrag.addItems($newSelector);

      // refresh all instances of this field
      const $fields = designer.$tabContainer.find(
        `.fld-field[data-id=${this.fieldId}]`
      );
      for (let i = 0; i < $fields.length; i++) {
        $fields.eq(i).data('fld-element')?.refresh();
      }
    });
  },

  async makeRequired() {
    await this.applyConfig((config) => {
      config.required = true;
      return config;
    });
  },

  async dropRequired() {
    await this.applyConfig((config) => {
      config.required = false;
      return config;
    });
  },

  async makeThumbnail() {
    await this.applyConfig((config) => {
      config.providesThumbs = true;
      return config;
    });
  },

  async dropThumbnail() {
    await this.applyConfig((config) => {
      config.providesThumbs = false;
      return config;
    });
  },

  async showInCards() {
    await this.applyConfig((config) => {
      config.includeInCards = true;
      return config;
    });
  },

  async omitFromCards() {
    await this.applyConfig((config) => {
      config.includeInCards = false;
      return config;
    });
  },

  moveUp() {
    const $prev = this.$container.prev('.fld-element');
    if ($prev.length) {
      this.$container.insertBefore($prev);
      this.updatePositionInConfig();
    }
  },

  moveDown() {
    const $next = this.$container.next('.fld-element');
    if ($next.length) {
      this.$container.insertAfter($next);
      this.updatePositionInConfig();
    }
  },

  async applyConfig(callback, withSettings = false) {
    const config = callback(this.config);
    if (config === false) {
      return;
    }

    let data;

    try {
      const response = await Craft.sendActionRequest(
        'POST',
        'fields/apply-layout-element-settings',
        {
          data: {
            config,
            elementType: this.tab.designer.settings.elementType,
            settingsNamespace: this.settingsNamespace,
            settings: withSettings
              ? this.slideout.$container.serialize()
              : null,
          },
        }
      );
      data = response.data;
    } catch (e) {
      Craft.cp.displayError(e?.response?.data?.message);
      throw e;
    }

    this.config = data.config;
    const $oldContainer = this.$container;
    const $newContainer = $(data.selectorHtml);
    this.$container.replaceWith($newContainer);
    this.$container = $newContainer;
    this.initUi();

    this.tab.designer.refreshSelectedFields();
    this.tab.designer.elementDrag.removeItems($oldContainer);
    this.tab.designer.elementDrag.addItems($newContainer);

    if (this.slideout) {
      this.slideout.close();
      this.slideout.destroy();
      this.slideout = null;
    }

    if (this.config.providesThumbs) {
      // make sure this is the only one
      const $fields = this.tab.designer.$tabContainer.find('.fld-field');
      for (let i = 0; i < $fields.length; i++) {
        const $field = $fields.eq(i);
        const element = $field.data('fld-element');
        if (element && element !== this && element.config.providesThumbs) {
          element.applyConfig((config) => {
            config.providesThumbs = false;
            return config;
          });
        }
      }
    }
  },

  async refresh() {
    await this.applyConfig((config) => config);
  },

  get index() {
    const tabConfig = this.tab.config;
    if (typeof tabConfig === 'undefined') {
      return -1;
    }
    return tabConfig.elements.findIndex((c) => c.uid === this.uid);
  },

  get config() {
    if (!this.uid) {
      throw 'Tab is missing its UID';
    }
    let config = this.tab.config.elements.find((c) => c.uid === this.uid);
    if (!config) {
      config = {
        uid: this.uid,
      };
      this.config = config;
    }
    return config;
  },

  set config(config) {
    const tabConfig = this.tab.config;
    const index = this.index;
    if (index !== -1) {
      tabConfig.elements[index] = config;
    } else {
      const newIndex = $.inArray(
        this.$container[0],
        this.$container.parent().children('.fld-element')
      );
      tabConfig.elements.splice(newIndex, 0, config);
    }
    this.tab.config = tabConfig;
  },

  updateConfig: function (callback) {
    const config = callback(this.config);
    if (config !== false) {
      this.config = config;
    }
  },

  updatePositionInConfig: function () {
    this.tab.updateConfig((config) => {
      const elementConfig = this.config;
      const oldIndex = this.index;
      const newIndex = $.inArray(
        this.$container[0],
        this.$container.parent().children('.fld-element')
      );
      if (oldIndex !== -1) {
        config.elements.splice(oldIndex, 1);
      }
      config.elements.splice(newIndex, 0, elementConfig);
      return config;
    });
  },

  destroy: function () {
    this.tab.updateConfig((config) => {
      const index = this.index;
      if (index === -1) {
        return false;
      }
      config.elements.splice(index, 1);
      return config;
    });

    this.tab.designer.elementDrag.removeItems(this.$container);
    this.$container.remove();

    if (this.isField) {
      this.tab.designer.refreshSelectedFields();

      if (!this.isMultiInstance) {
        this.tab.designer.removeFieldByHandle(this.defaultHandle);
      }
    }

    this.base();
  },
});

Craft.FieldLayoutDesigner.BaseDrag = Garnish.Drag.extend({
  designer: null,
  $insertion: null,
  showingInsertion: false,
  $caboose: null,

  /**
   * Constructor
   */
  init: function (designer, settings) {
    this.designer = designer;
    this.base(this.findItems(), settings);
  },

  /**
   * On Drag Start
   */
  onDragStart: function () {
    this.base();

    // Create the insertion
    this.$insertion = this.createInsertion();

    // Add the caboose
    this.$caboose = this.createCaboose();
    this.$items = $().add(this.$items.add(this.$caboose));

    Garnish.$bod.addClass('dragging');
  },

  removeCaboose: function () {
    this.$items = this.$items.not(this.$caboose);
    this.$caboose.remove();
  },

  swapDraggeeWithInsertion: function () {
    this.$insertion.insertBefore(this.$draggee);
    this.$draggee.detach();
    this.$items = $().add(this.$items.not(this.$draggee).add(this.$insertion));
    this.showingInsertion = true;
  },

  swapInsertionWithDraggee: function () {
    this.$insertion.replaceWith(this.$draggee);
    this.$items = $().add(this.$items.not(this.$insertion).add(this.$draggee));
    this.showingInsertion = false;
  },

  /**
   * Sets the item midpoints up front so we don't have to keep checking on every mouse move
   */
  setMidpoints: function () {
    for (let i = 0; i < this.$items.length; i++) {
      let $item = $(this.$items[i]);
      let offset = $item.offset();

      // Skip library elements
      if ($item.hasClass('unused')) {
        continue;
      }

      $item.data('midpoint', {
        left: offset.left + $item.outerWidth() / 2,
        top: offset.top + $item.outerHeight() / 2,
      });
    }
  },

  /**
   * Returns the closest item to the cursor.
   */
  getClosestItem: function () {
    this.getClosestItem._closestItem = null;
    this.getClosestItem._closestItemMouseDiff = null;

    for (
      this.getClosestItem._i = 0;
      this.getClosestItem._i < this.$items.length;
      this.getClosestItem._i++
    ) {
      this.getClosestItem._$item = $(this.$items[this.getClosestItem._i]);

      this.getClosestItem._midpoint =
        this.getClosestItem._$item.data('midpoint');
      if (!this.getClosestItem._midpoint) {
        continue;
      }

      this.getClosestItem._mouseDiff = Garnish.getDist(
        this.getClosestItem._midpoint.left,
        this.getClosestItem._midpoint.top,
        this.mouseX,
        this.mouseY
      );

      if (
        this.getClosestItem._closestItem === null ||
        this.getClosestItem._mouseDiff <
          this.getClosestItem._closestItemMouseDiff
      ) {
        this.getClosestItem._closestItem = this.getClosestItem._$item[0];
        this.getClosestItem._closestItemMouseDiff =
          this.getClosestItem._mouseDiff;
      }
    }

    return this.getClosestItem._closestItem;
  },

  checkForNewClosestItem: function () {
    // Is there a new closest item?
    this.checkForNewClosestItem._closestItem = this.getClosestItem();

    if (this.checkForNewClosestItem._closestItem === this.$insertion[0]) {
      return;
    }

    if (
      this.showingInsertion &&
      $.inArray(this.$insertion[0], this.$items) <
        $.inArray(this.checkForNewClosestItem._closestItem, this.$items) &&
      $.inArray(this.checkForNewClosestItem._closestItem, this.$caboose) === -1
    ) {
      this.$insertion.insertAfter(this.checkForNewClosestItem._closestItem);
    } else {
      this.$insertion.insertBefore(this.checkForNewClosestItem._closestItem);
    }

    // we only want to do it all if there's at least one tab in the layout
    if (this.designer.tabGrid.$items.length > 0) {
      this.$items = $().add(this.$items.add(this.$insertion));
      this.showingInsertion = true;
      this.designer.tabGrid.refreshCols(true);
      this.setMidpoints();
    }
  },

  /**
   * On Drag Stop
   */
  onDragStop: function () {
    if (this.showingInsertion) {
      this.swapInsertionWithDraggee();
    }

    this.removeCaboose();

    this.designer.tabGrid.refreshCols(true);

    // return the helpers to the draggees
    let offset = this.$draggee.offset();
    if (!offset || (offset.top === 0 && offset.left === 0)) {
      this.$draggee
        .css({
          display: this.draggeeDisplay,
          visibility: 'visible',
          opacity: 0,
        })
        .velocity({opacity: 1}, Garnish.FX_DURATION);
      this.helpers[0].velocity({opacity: 0}, Garnish.FX_DURATION, () => {
        this._showDraggee();
      });
    } else {
      this.returnHelpersToDraggees();
    }

    this.base();

    Garnish.$bod.removeClass('dragging');
  },
});

Craft.FieldLayoutDesigner.TabDrag = Craft.FieldLayoutDesigner.BaseDrag.extend({
  /**
   * Constructor
   */
  init: function (designer) {
    let settings = {
      handle: '.tab',
    };

    this.base(designer, settings);
  },

  findItems: function () {
    return this.designer.$tabContainer.find('> div.fld-tab');
  },

  /**
   * On Drag Start
   */
  onDragStart: function () {
    this.base();
    this.swapDraggeeWithInsertion();
    this.setMidpoints();
  },

  swapDraggeeWithInsertion: function () {
    this.base();
    this.designer.tabGrid.removeItems(this.$draggee);
    this.designer.tabGrid.addItems(this.$insertion);
  },

  swapInsertionWithDraggee: function () {
    this.base();
    this.designer.tabGrid.removeItems(this.$insertion);
    this.designer.tabGrid.addItems(this.$draggee);
  },

  /**
   * On Drag
   */
  onDrag: function () {
    this.checkForNewClosestItem();
    this.base();
  },

  /**
   * On Drag Stop
   */
  onDragStop: function () {
    this.base();

    // "show" the tab, but make it invisible
    this.$draggee.css({
      display: this.draggeeDisplay,
      visibility: 'hidden',
    });

    this.$draggee.data('fld-tab').updatePositionInConfig();
  },

  /**
   * Creates the caboose
   */
  createCaboose: function () {
    let $caboose = $('<div class="fld-tab fld-tab-caboose"/>').appendTo(
      this.designer.$tabContainer
    );
    this.designer.tabGrid.addItems($caboose);
    return $caboose;
  },

  /**
   * Removes the caboose
   */
  removeCaboose: function () {
    this.base();
    this.designer.tabGrid.removeItems(this.$caboose);
  },

  /**
   * Creates the insertion
   */
  createInsertion: function () {
    let $tab = this.$draggee.find('.tab');

    return $(`
<div class="fld-tab fld-insertion" style="height: ${this.$draggee.height()}px;">
  <div class="tabs"><div class="tab sel draggable" style="width: ${$tab.outerWidth()}px; height: ${
    $tab.outerHeight() + 2
  }px;"></div></div>
  <div class="fld-tabcontent" style="height: ${
    this.$draggee.find('.fld-tabcontent').height() - 2
  }px;"></div>
</div>
`);
  },
});

Craft.FieldLayoutDesigner.ElementDrag =
  Craft.FieldLayoutDesigner.BaseDrag.extend({
    draggingLibraryElement: false,
    draggingField: false,
    draggingMultiInstanceElement: false,
    originalTab: null,

    /**
     * On Drag Start
     */
    onDragStart: function () {
      this.base();

      // Are we dragging an element from the library?
      this.draggingLibraryElement = this.$draggee.hasClass('unused');

      // Is it a field?
      this.draggingField = this.$draggee.hasClass('fld-field');

      // Can the element have multiple instances?
      this.draggingMultiInstanceElement = Garnish.hasAttr(
        this.$draggee,
        'data-is-multi-instance'
      );

      // keep UI elements visible
      if (this.draggingLibraryElement && this.draggingMultiInstanceElement) {
        this.$draggee.css({
          display: this.draggeeDisplay,
          visibility: 'visible',
        });
      }

      // Swap the draggee with the insertion if dragging a selected item
      if (!this.draggingLibraryElement) {
        this.originalTab = this.$draggee.closest('.fld-tab').data('fld-tab');
        this.swapDraggeeWithInsertion();
      } else {
        this.originalTab = null;
      }

      this.setMidpoints();
    },

    /**
     * On Drag
     */
    onDrag: function () {
      if (this.isDraggeeMandatory() || this.isHoveringOverTab()) {
        this.checkForNewClosestItem();
      } else if (this.showingInsertion) {
        this.$insertion.remove();
        this.$items = $().add(this.$items.not(this.$insertion));
        this.showingInsertion = false;
        this.designer.tabGrid.refreshCols(true);
        this.setMidpoints();
      }

      this.base();
    },

    isDraggeeMandatory: function () {
      return Garnish.hasAttr(this.$draggee, 'data-mandatory');
    },

    isHoveringOverTab: function () {
      for (let i = 0; i < this.designer.tabGrid.$items.length; i++) {
        if (
          Garnish.hitTest(
            this.mouseX,
            this.mouseY,
            this.designer.tabGrid.$items.eq(i)
          )
        ) {
          return true;
        }
      }

      return false;
    },

    findItems: function () {
      // Return all of the used + unused fields
      return this.designer.$tabContainer
        .find('.fld-element')
        .add(this.designer.$sidebar.find('.fld-element'));
    },

    /**
     * Creates the caboose
     */
    createCaboose: function () {
      let $caboose = $();
      let $fieldContainers = this.designer.$tabContainer.find(
        '> .fld-tab > .fld-tabcontent'
      );

      for (let i = 0; i < $fieldContainers.length; i++) {
        $caboose = $caboose.add($('<div/>').appendTo($fieldContainers[i]));
      }

      return $caboose;
    },

    /**
     * Creates the insertion
     */
    createInsertion: function () {
      return $(
        `<div class="fld-element fld-insertion" style="height: ${this.$draggee.outerHeight()}px;"/>`
      );
    },

    /**
     * On Drag Stop
     */
    onDragStop: function () {
      let showingInsertion = this.showingInsertion;
      if (showingInsertion) {
        if (this.draggingLibraryElement) {
          // Create a new element based on that one
          const $element = this.$draggee.clone().removeClass('unused');

          if (!this.draggingMultiInstanceElement) {
            // Hide the library field
            this.$draggee
              .css({visibility: 'inherit', display: 'field'})
              .addClass('hidden');

            // Hide the group too?
            if (
              this.$draggee.siblings('.fld-field:not(.hidden)').length === 0
            ) {
              this.$draggee.closest('.fld-field-group').addClass('hidden');
            }
          }

          // Set this.$draggee to the clone, as if we were dragging that all along
          this.$draggee = $element;

          // Remember it for later
          this.addItems($element);
        }
      } else if (!this.draggingLibraryElement) {
        let $libraryElement = this.draggingField
          ? this.designer.$fields.filter(
              `[data-attribute="${this.$draggee.data('attribute')}"]:first`
            )
          : this.designer.$uiLibraryElements.filter(
              `[data-type="${this.$draggee.data('type')}"]:first`
            );

        if (this.draggingField) {
          // show the field in the library
          $libraryElement.removeClass('hidden');
          $libraryElement.closest('.fld-field-group').removeClass('hidden');
        }

        // Destroy the original element
        this.$draggee.data('fld-element').destroy();

        // Set this.$draggee to the library element, as if we were dragging that all along
        this.$draggee = $libraryElement;
      }

      this.base();

      this.$draggee.css({
        display: this.draggeeDisplay,
        visibility:
          this.draggingField || showingInsertion ? 'hidden' : 'visible',
      });

      if (showingInsertion) {
        const tab = this.$draggee.closest('.fld-tab').data('fld-tab');
        let element;

        if (this.draggingLibraryElement) {
          element = tab.initElement(this.$draggee);
        } else {
          element = this.$draggee.data('fld-element');

          // New tab?
          if (tab !== this.originalTab) {
            const config = element.config;

            this.originalTab.updateConfig((config) => {
              const index = element.index;
              if (index === -1) {
                return false;
              }
              config.elements.splice(index, 1);
              return config;
            });

            this.$draggee.data('fld-element').tab = tab;
            element.config = config;
          }
        }

        element.updatePositionInConfig();
      }
    },
  });
