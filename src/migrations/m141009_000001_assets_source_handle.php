<?php
namespace craft\app\migrations;

/**
 * The class name is the UTC timestamp in the format of mYYMMDD_HHMMSS_migrationName
 */
class m141009_000001_assets_source_handle extends BaseMigration
{
	/**
	 * Any migration code in here is wrapped inside of a transaction.
	 *
	 * @return bool
	 */
	public function safeUp()
	{
		Craft::log('Adding `handle` column on assetsources table..', LogLevel::Info, true);
		$this->addColumnAfter('assetsources', 'handle', array('maxLength' => 255, 'column' => 'varchar', 'required' => true), 'name');

		$sourceRows = craft()->db->createCommand()
			->select('id, name')
			->from('assetsources')
			->queryAll();

		Craft::log('Generating handles for Asset sources..', LogLevel::Info, true);

		foreach ($sourceRows as $row)
		{
			$sourceName = $row['name'];
			$handle = $this->_makeHandle($sourceName);

			craft()->db->createCommand()
				->update('assetsources', array('handle' => $handle), 'id = :sourceId', array(':sourceId' => $row['id']));
		}

		Craft::log('Adding unique index on `handle` column on assetsources table..', LogLevel::Info, true);
		$this->createIndex('assetsources', 'handle', true);
		Craft::log('Done creating handles for Asset sources.', LogLevel::Info, true);

		return true;
	}

	/**
	 * Make handle from source name.
	 *
	 * @param $name
	 *
	 * @return string
	 */
	private function _makeHandle($name)
	{
		// Remove HTML tags
		$handle = preg_replace('/<(.*?)>/', '', $name);
		$handle = preg_replace('/<[\'"‘’“”\[\]\(\)\{\}:]>/', '', $handle);
		$handle = StringHelper::toLowerCase($handle);
		$handle = StringHelper::asciiString($handle);
		$handle = preg_replace('/^[^a-z]+/', '', $handle);
		$handleParts = preg_split('/[^a-z0-9]+/', $handle);

		$handle = '';

		foreach ($handleParts as $index => &$part)
		{
			if ($index)
			{
				$part = ucfirst($part);
			}

			$handle .= $part;
		}

		$appendix = '';

		while (true)
		{
			$taken = craft()->db->createCommand()
				->select('handle')->from('assetsources')
				->where('handle = :handle', array(':handle' => $handle.$appendix))
				->queryScalar();

			if ($taken)
			{
				$appendix = ((int) $appendix) + 1;
			}
			else
			{
				break;
			}
		}

		return $handle.$appendix;
	}
}
