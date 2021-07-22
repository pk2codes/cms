<?php
/**
 * @link https://craftcms.com/
 * @copyright Copyright (c) Pixel & Tonic, Inc.
 * @license https://craftcms.github.io/license/
 */

namespace craft\mutex;

/**
 * @author Pixel & Tonic, Inc. <support@pixelandtonic.com>
 * @since 3.6.0
 * @mixin MysqlMutex
 * @mixin PgsqlMutex
 */
trait PrefixedMutexTrait
{
    /**
     * @var string a string prefixed to every lock name. This can be used to avoid lock conflicts if
     * multiple applications are sharing the same database connection.
     */
    public string $namePrefix = '';

    /**
     * @param string $name
     * @param int $timeout
     * @return bool
     */
    public function acquire($name, $timeout = 0): bool
    {
        return parent::acquire($this->_name($name), $timeout);
    }

    /**
     * @param string $name
     * @return bool
     */
    public function release($name): bool
    {
        return parent::release($this->_name($name));
    }

    /**
     * @param string $name
     * @return bool
     */
    public function isAcquired($name): bool
    {
        return parent::isAcquired($this->_name($name));
    }

    /**
     * @param string $name
     * @return string
     */
    private function _name(string $name): string
    {
        return $this->namePrefix . $name;
    }
}
