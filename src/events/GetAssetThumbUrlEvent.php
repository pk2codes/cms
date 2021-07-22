<?php
/**
 * @link https://craftcms.com/
 * @copyright Copyright (c) Pixel & Tonic, Inc.
 * @license https://craftcms.github.io/license/
 */

namespace craft\events;

use craft\elements\Asset;
use yii\base\Event;

/**
 * Get Asset thumb url event class
 *
 * @author Pixel & Tonic, Inc. <support@pixelandtonic.com>
 * @since 3.0.0
 * @todo rename to AssetThumbUrlEvent in Craft 4
 */
class GetAssetThumbUrlEvent extends Event
{
    /**
     * @var Asset The Asset which the thumbnail should be for.
     */
    public Asset $asset;

    /**
     * @var int Requested thumbnail width
     */
    public int $width;

    /**
     * @var int Requested thumbnail height
     */
    public int $height;

    /**
     * @var bool Whether the thumbnail should be generated if it doesn't exist yet.
     */
    public bool $generate;

    /**
     * @var string|null Url to requested Asset that should be used instead.
     */
    public ?string $url;
}
