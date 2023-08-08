<?php
/**
 * @link https://craftcms.com/
 * @copyright Copyright (c) Pixel & Tonic, Inc.
 * @license https://craftcms.github.io/license/
 */

namespace craft\auth\mapper;

use Craft;
use craft\base\Component;
use craft\elements\User;
use craft\helpers\ArrayHelper;

class IdpAttributeUserMap extends Component implements UserMapInterface
{
    use SetUserValueTrait;

    /**
     * @var string
     */
    public string $idpProperty;

    /**
     * @inheritDoc
     */
    public function __invoke(User $user, mixed $data): User
    {
        $value = ArrayHelper::getValue($data, $this->idpProperty);

        if (is_null($value)) {
            Craft::warning(
                sprintf(
                    "Attribute mapper value was not found in IdP data set: %s. Skipping",
                    $this->idpProperty
                ),
                "auth"
            );

            return $user;
        }

        $this->setValue($user, $value);

        return $user;
    }
}
