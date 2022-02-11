<?php

// Enrico Simonetti
// enricosimonetti.com
//
// 2017-11-01 on Sugar 7.9.2.0

function usage($error = '')
{
    if (!empty($error)) {
        print(PHP_EOL . 'Error: ' . $error . PHP_EOL);
    }
    print('  php ' . __FILE__ . ' --instance /full/path' . PHP_EOL);
    exit(1);
}

// only allow CLI
$sapi_type = PHP_SAPI;
if (!str_starts_with($sapi_type, 'cli')) {
    die(__FILE__ . ' is CLI only.');
}

// get command line params
$o = getopt('', array('instance:'));
if (!$o) {
    $o['instance'] = __DIR__.'/public/legacy';
}

// find directory
if (!empty($o['instance']) && is_dir($o['instance'])) {
    print('Debug: Entering directory ' . $o['instance'] . PHP_EOL);
    chdir($o['instance']);
} else {
    chdir(__DIR__);
}

if (!file_exists('config.php') || !file_exists('sugar_version.php')) {
    usage('The provided directory is not a Sugar system');
}

// sugar basic setup
const sugarEntry = true;
require_once('include/entryPoint.php');

if (extension_loaded('xdebug')) {
    echo 'Xdebug is enabled on this system. Xdebug will cause unwanted slowness, trying to disable...'.PHP_EOL;
}

// temporarily stop xdebug, xhprof and tideways if enabled
if (function_exists('xdebug_disable')) {
    xdebug_disable();
}

if (function_exists('xhprof_disable')) {
    xhprof_disable();
    xhprof_sample_disable();
}

if (function_exists('tideways_disable')) {
    tideways_disable();
}

if (empty($current_language)) {
    $current_language = $sugar_config['default_language'];
}

$app_list_strings = return_app_list_strings_language($current_language);
$app_strings = return_application_language($current_language);
$mod_strings = return_module_language($current_language, 'Administration');

global $current_user;
$current_user = BeanFactory::getBean('Users');
$current_user->getSystemUser();

$start_time = microtime(true);

echo 'Repairing...' . PHP_EOL;

if (SugarCache::instance()->useBackend()) {
    // clear cache
    SugarCache::instance()->reset();
    SugarCache::instance()->resetFull();
}

SugarCache::cleanOpcodes();
// clear opcache before #79804
if (function_exists('opcache_reset')) {
    opcache_reset();
}

require_once('modules/Administration/QuickRepairAndRebuild.php');

exec('cd ../.. && ./clear_cache.sh');

// repair
$repair = new RepairAndClear();
$repair->repairAndClearAll(array('clearAll'), array($mod_strings['LBL_ALL_MODULES']), true, false, '');

// quick load of all beans
global $beanList;
$full_module_list = array_merge($beanList, $app_list_strings['moduleList']);

foreach ($full_module_list as $module => $label) {
    $bean = BeanFactory::newBean($module);
    // load language too
    LanguageManager::createLanguageFile($module, array('default'), true);
    $mod_strings = return_module_language($current_language, $module);
}

// load app strings
$app_list_strings = return_app_list_strings_language($current_language);
$app_strings = return_application_language($current_language);

// when the other register shutdown functionalities complete, exit this script
register_shutdown_function(
    static function($start) {
        print('Repair completed in ' . (int)(microtime(true) - $start) . ' seconds.' . PHP_EOL);
    },
    $start_time
);
