<?php
/**
 * @link https://craftcms.com/
 * @copyright Copyright (c) Pixel & Tonic, Inc.
 * @license https://craftcms.github.io/license/
 */

namespace craft\models;

use Craft;
use craft\base\Model;
use craft\behaviors\FieldLayoutBehavior;
use craft\db\Table;
use craft\elements\Category;
use craft\helpers\ArrayHelper;
use craft\helpers\Db;
use craft\helpers\StringHelper;
use craft\records\CategoryGroup as CategoryGroupRecord;
use craft\validators\HandleValidator;
use craft\validators\UniqueValidator;

/**
 * CategoryGroup model.
 *
 * @property CategoryGroup_SiteSettings[] $siteSettings Site-specific settings
 * @mixin FieldLayoutBehavior
 * @author Pixel & Tonic, Inc. <support@pixelandtonic.com>
 * @since 3.0.0
 */
class CategoryGroup extends Model
{
    /** @since 3.7.0 */
    const DEFAULT_PLACEMENT_BEGINNING = 'beginning';
    /** @since 3.7.0 */
    const DEFAULT_PLACEMENT_END = 'end';

    /**
     * @var int|null ID
     */
    public ?int $id;

    /**
     * @var int|null Structure ID
     */
    public ?int $structureId;

    /**
     * @var int|null Field layout ID
     */
    public ?int $fieldLayoutId;

    /**
     * @var string|null Name
     */
    public ?string $name;

    /**
     * @var string|null Handle
     */
    public ?string $handle;

    /**
     * @var int|null Max levels
     */
    public ?int $maxLevels;

    /**
     * @var string Default placement
     * @since 3.7.0
     */
    public string $defaultPlacement = self::DEFAULT_PLACEMENT_END;

    /**
     * @var string|null UID
     */
    public ?string $uid;

    /**
     * @var
     */
    private array $_siteSettings;

    /**
     * @inheritdoc
     */
    public function behaviors(): array
    {
        $behaviors = parent::behaviors();
        $behaviors['fieldLayout'] = [
            'class' => FieldLayoutBehavior::class,
            'elementType' => Category::class,
        ];
        return $behaviors;
    }

    /**
     * @inheritdoc
     */
    public function attributeLabels(): array
    {
        return [
            'handle' => Craft::t('app', 'Handle'),
            'name' => Craft::t('app', 'Name'),
        ];
    }

    /**
     * @inheritdoc
     */
    protected function defineRules(): array
    {
        $rules = parent::defineRules();
        $rules[] = [['id', 'structureId', 'fieldLayoutId', 'maxLevels'], 'number', 'integerOnly' => true];
        $rules[] = [['handle'], HandleValidator::class, 'reservedWords' => ['id', 'dateCreated', 'dateUpdated', 'uid', 'title']];
        $rules[] = [['name', 'handle'], UniqueValidator::class, 'targetClass' => CategoryGroupRecord::class];
        $rules[] = [['name', 'handle', 'siteSettings'], 'required'];
        $rules[] = [['name', 'handle'], 'string', 'max' => 255];
        $rules[] = [['defaultPlacement'], 'in', 'range' => [self::DEFAULT_PLACEMENT_BEGINNING, self::DEFAULT_PLACEMENT_END]];
        $rules[] = [['fieldLayout'], 'validateFieldLayout'];
        $rules[] = [['siteSettings'], 'validateSiteSettings'];
        return $rules;
    }

    /**
     * Validates the field layout.
     *
     * @since 3.7.0
     */
    public function validateFieldLayout(): void
    {
        $fieldLayout = $this->getFieldLayout();
        $fieldLayout->reservedFieldHandles = [
            'group',
        ];

        if (!$fieldLayout->validate()) {
            $this->addModelErrors($fieldLayout, 'fieldLayout');
        }
    }

    /**
     * Validates the site settings.
     */
    public function validateSiteSettings(): void
    {
        foreach ($this->getSiteSettings() as $i => $siteSettings) {
            if (!$siteSettings->validate()) {
                $this->addModelErrors($siteSettings, "siteSettings[{$i}]");
            }
        }
    }

    /**
     * Use the translated category group's name as the string representation.
     *
     * @return string
     */
    public function __toString(): string
    {
        return Craft::t('site', $this->name) ?: static::class;
    }

    /**
     * Returns the group's site-specific settings.
     *
     * @return CategoryGroup_SiteSettings[]
     */
    public function getSiteSettings(): array
    {
        if ($this->_siteSettings !== null) {
            return $this->_siteSettings;
        }

        if (!$this->id) {
            return [];
        }

        // Set them with setSiteSettings() so setGroup() gets called on them
        $this->setSiteSettings(ArrayHelper::index(Craft::$app->getCategories()->getGroupSiteSettings($this->id), 'siteId'));

        return $this->_siteSettings;
    }

    /**
     * Sets the group's site-specific settings.
     *
     * @param CategoryGroup_SiteSettings[] $siteSettings
     */
    public function setSiteSettings(array $siteSettings): void
    {
        $this->_siteSettings = $siteSettings;

        foreach ($this->_siteSettings as $settings) {
            $settings->setGroup($this);
        }
    }

    /**
     * Returns the field layout config for this category group.
     *
     * @return array
     * @since 3.5.0
     */
    public function getConfig(): array
    {
        $config = [
            'name' => $this->name,
            'handle' => $this->handle,
            'structure' => [
                'uid' => $this->structureId ? Db::uidById(Table::STRUCTURES, $this->structureId) : StringHelper::UUID(),
                'maxLevels' => (int)$this->maxLevels ?: null,
            ],
            'siteSettings' => [],
            'defaultPlacement' => $this->defaultPlacement ?? self::DEFAULT_PLACEMENT_END,
        ];

        $fieldLayout = $this->getFieldLayout();

        if ($fieldLayoutConfig = $fieldLayout->getConfig()) {
            if (!$fieldLayout->uid) {
                $fieldLayout->uid = $fieldLayout->id ? Db::uidById(Table::FIELDLAYOUTS, $fieldLayout->id) : StringHelper::UUID();
            }
            $config['fieldLayouts'] = [
                $fieldLayout->uid => $fieldLayoutConfig,
            ];
        }

        foreach ($this->getSiteSettings() as $siteId => $settings) {
            $siteUid = Db::uidById(Table::SITES, $siteId);
            $config['siteSettings'][$siteUid] = [
                'hasUrls' => (bool)$settings['hasUrls'],
                'uriFormat' => $settings['uriFormat'] ?: null,
                'template' => $settings['template'] ?: null,
            ];
        }

        return $config;
    }
}
