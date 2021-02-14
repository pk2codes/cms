<?php
/**
 * @link https://craftcms.com/
 * @copyright Copyright (c) Pixel & Tonic, Inc.
 * @license https://craftcms.github.io/license/
 */

namespace craft\services;

use Craft;
use craft\db\Table;
use craft\helpers\DateTimeHelper;
use craft\helpers\Db;
use yii\base\Component;

/**
 * Garbage collection service.
 * An instance of the GC service is globally accessible in Craft via [[\craft\base\ApplicationTrait::getGc()|`Craft::$app->gc`]].
 *
 * @author Pixel & Tonic, Inc. <support@pixelandtonic.com>
 * @since 3.1.0
 */
class Gc extends Component
{
    /**
     * @event Event The event that is triggered when running garbage collection.
     */
    const EVENT_RUN = 'run';

    /**
     * @var int the probability (parts per million) that garbage collection (GC) should be performed
     * on a request. Defaults to 10, meaning 0.001% chance.
     *
     * This number should be between 0 and 1000000. A value 0 means no GC will be performed at all unless forced.
     */
    public $probability = 10;

    /**
     * @var bool whether [[hardDelete()]] should delete *all* soft-deleted rows,
     * rather than just the ones that were deleted long enough ago to be ready
     * for hard-deletion per the <config3:softDeleteDuration> config setting.
     */
    public $deleteAllTrashed = false;

    /**
     * Possibly runs garbage collection.
     *
     * @param bool $force Whether garbage collection should be forced. If left as `false`, then
     * garbage collection will only run if a random condition passes, factoring in [[probability]].
     */
    public function run(bool $force = false)
    {
        if (!$force && mt_rand(0, 1000000) >= $this->probability) {
            return;
        }

        Craft::$app->getUsers()->purgeExpiredPendingUsers();
        $this->_deleteStaleSessions();

        $this->hardDelete([
            Table::ELEMENTS, // elements should always go first
            Table::CATEGORYGROUPS,
            Table::ENTRYTYPES,
            Table::FIELDGROUPS,
            Table::SECTIONS,
            Table::TAGGROUPS,
            Table::VOLUMES,
        ]);

        $this->_deleteOrphanedDraftsAndRevisions();
        Craft::$app->getSearch()->deleteOrphanedIndexes();

        // Fire a 'run' event
        if ($this->hasEventHandlers(self::EVENT_RUN)) {
            $this->trigger(self::EVENT_RUN);
        }

        $this->hardDelete([
            Table::STRUCTURES,
            Table::FIELDLAYOUTS,
            Table::SITES,
        ]);
    }

    /**
     * Hard-deletes any rows in the given table(s), that are due for it.
     *
     * @param string|string[] $tables The table(s) to delete rows from. They must have a `dateDeleted` column.
     */
    public function hardDelete($tables)
    {
        $generalConfig = Craft::$app->getConfig()->getGeneral();
        if (!$generalConfig->softDeleteDuration && !$this->deleteAllTrashed) {
            return;
        }

        $condition = ['not', ['dateDeleted' => null]];

        if (!$this->deleteAllTrashed) {
            $expire = DateTimeHelper::currentUTCDateTime();
            $interval = DateTimeHelper::secondsToInterval($generalConfig->softDeleteDuration);
            $pastTime = $expire->sub($interval);
            $condition = [
                'and',
                $condition,
                ['<', 'dateDeleted', Db::prepareDateForDb($pastTime)],
            ];
        }

        if (!is_array($tables)) {
            $tables = [$tables];
        }

        foreach ($tables as $table) {
            Db::delete($table, $condition);
        }
    }

    /**
     * Deletes any session rows that have gone stale.
     */
    private function _deleteStaleSessions()
    {
        $generalConfig = Craft::$app->getConfig()->getGeneral();

        if ($generalConfig->purgeStaleUserSessionDuration === 0) {
            return;
        }

        $interval = DateTimeHelper::secondsToInterval($generalConfig->purgeStaleUserSessionDuration);
        $expire = DateTimeHelper::currentUTCDateTime();
        $pastTime = $expire->sub($interval);

        Db::delete(Table::SESSIONS, ['<', 'dateUpdated', Db::prepareDateForDb($pastTime)]);
    }

    /**
     * Deletes any orphaned rows in the `drafts` and `revisions` tables.
     *
     * @return void
     */
    private function _deleteOrphanedDraftsAndRevisions(): void
    {
        $db = Craft::$app->getDb();
        $elementsTable = Table::ELEMENTS;

        foreach (['draftId' => Table::DRAFTS, 'revisionId' => Table::REVISIONS] as $fk => $table) {
            if ($db->getIsMysql()) {
                $sql = <<<SQL
DELETE [[t]].* FROM $table [[t]]
LEFT JOIN $elementsTable [[e]] ON [[e.$fk]] = [[t.id]]
WHERE [[e.id]] IS NULL
SQL;
            } else {
                $sql = <<<SQL
DELETE FROM $table
USING $table [[t]]
LEFT JOIN $elementsTable [[e]] ON [[e.$fk]] = [[t.id]]
WHERE
  $table.[[id]] = [[t.id]] AND
  [[e.id]] IS NULL
SQL;
            }

            $db->createCommand($sql)->execute();
        }
    }
}
