<?php
namespace craft\app\enums;

/**
 * The TaskStatus class is an abstract class that defines the different task status options available in Craft for the
 * {@link TaskService}.
 *
 * This class is a poor man's version of an enum, since PHP does not have support for native enumerations.
 *
 * @author    Pixel & Tonic, Inc. <support@pixelandtonic.com>
 * @copyright Copyright (c) 2014, Pixel & Tonic, Inc.
 * @license   http://buildwithcraft.com/license Craft License Agreement
 * @see       http://buildwithcraft.com
 * @package   craft.app.enums
 * @since     2.0
 */
abstract class TaskStatus
{
	// Constants
	// =========================================================================

	const Pending = 'pending';
	const Running = 'running';
	const Error   = 'error';
}
