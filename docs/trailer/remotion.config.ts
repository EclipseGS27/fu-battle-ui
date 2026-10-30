/**
 * All configuration options: https://remotion.dev/docs/config
 */
import { Config } from '@remotion/cli/config';

Config.setRspack(true);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setConcurrency(3);
Config.setDefaultPremountInSeconds(2);
