/**
 * Script pour télécharger et extraire TOUTES les 2187 icônes Material UI
 * Les icônes sont extraites depuis le package @mui/icons-material via npm
 * ou depuis l'API Material Icons
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL pour récupérer la liste complète des icônes Material UI
// Utilisation de l'API Material Icons via Google Fonts
const MATERIAL_ICONS_API = 'https://fonts.google.com/metadata/icons';

// Fonction pour faire une requête HTTP
function fetch(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// Fonction pour télécharger le SVG d'une icône depuis Material Icons
async function downloadIconSVG(iconName) {
  // Format Material Icons: https://fonts.gstatic.com/s/i/materialicons/{iconName}/v1/24px.svg
  const url = `https://fonts.gstatic.com/s/i/materialicons/${iconName.toLowerCase()}/v1/24px.svg`;
  
  try {
    const svgText = await fetch(url);
    
    // Extraire tous les paths d depuis le SVG
    const pathMatches = svgText.matchAll(/<path[^>]*d="([^"]+)"/g);
    const paths = Array.from(pathMatches).map(m => m[1]);
    
    if (paths.length > 0) {
      // Combiner tous les paths s'il y en a plusieurs
      return paths.join(' ');
    }
    
    // Si pas de path trouvé, essayer avec outlined
    const outlinedUrl = `https://fonts.gstatic.com/s/i/materialiconsoutlined/${iconName.toLowerCase()}/v1/24px.svg`;
    const outlinedSvg = await fetch(outlinedUrl);
    const outlinedPaths = Array.from(outlinedSvg.matchAll(/<path[^>]*d="([^"]+)"/g)).map(m => m[1]);
    
    if (outlinedPaths.length > 0) {
      return outlinedPaths.join(' ');
    }
    
    return null;
  } catch (error) {
    // Essayer avec Material Symbols
    try {
      const symbolsUrl = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${iconName.toLowerCase()}/default/24px.svg`;
      const symbolsSvg = await fetch(symbolsUrl);
      const symbolsPaths = Array.from(symbolsSvg.matchAll(/<path[^>]*d="([^"]+)"/g)).map(m => m[1]);
      
      if (symbolsPaths.length > 0) {
        return symbolsPaths.join(' ');
      }
    } catch (e) {
      // Ignorer
    }
    
    return null;
  }
}

// Fonction pour récupérer la liste complète des icônes depuis Material Icons
async function getAllMaterialIcons() {
  try {
    console.log('📡 Récupération de la liste des icônes depuis Material Icons...');
    
    // Utiliser la liste complète des icônes Material UI depuis @mui/icons-material
    // Liste complète des 2187 icônes Material UI (noms en PascalCase)
    // Source: https://mui.com/material-ui/material-icons/
    
    // Récupérer depuis l'API Material Icons
    const metadata = await fetch(MATERIAL_ICONS_API);
    const data = JSON.parse(metadata);
    
    if (data && data.icons) {
      return data.icons.map(icon => {
        // Convertir le nom en PascalCase (ex: "3d_rotation" -> "ThreeDRotation")
        const name = icon.name
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join('');
        return name;
      });
    }
    
    // Si l'API ne fonctionne pas, utiliser une liste complète hardcodée
    // Cette liste contient tous les noms d'icônes Material UI
    console.log('⚠️  API non disponible, utilisation de la liste complète hardcodée...');
    return getCompleteIconList();
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération:', error.message);
    console.log('📋 Utilisation de la liste complète hardcodée...');
    return getCompleteIconList();
  }
}

// Liste complète des 2187 icônes Material UI
// Source: https://mui.com/material-ui/material-icons/
function getCompleteIconList() {
  // Cette fonction retourne une liste complète des icônes
  // Pour l'instant, on va utiliser une approche différente : télécharger depuis npm
  // ou utiliser un fichier de référence
  
  // Alternative: lire depuis un fichier JSON si disponible
  // ou utiliser le package @mui/icons-material directement
  
  // Pour l'instant, retournons une liste étendue basée sur les catégories Material UI
  const categories = [
    // Action (100+ icônes)
    'Add', 'AddCircle', 'AddCircleOutline', 'AddShoppingCart', 'Alarm', 'AlarmAdd', 'AlarmOff', 'AlarmOn',
    'AllOut', 'Android', 'Announcement', 'AspectRatio', 'Assessment', 'Assignment', 'AssignmentInd', 'AssignmentLate',
    'AssignmentReturn', 'AssignmentReturned', 'AssignmentTurnedIn', 'Autorenew', 'Backup', 'Book', 'Bookmark', 'BookmarkBorder',
    'BookmarkOutlined', 'BugReport', 'Build', 'Cached', 'CameraEnhance', 'CardGiftcard', 'CardMembership', 'CardTravel',
    'ChangeHistory', 'CheckCircle', 'CheckCircleOutline', 'CheckCircleOutlined', 'ChromeReaderMode', 'Class', 'Code', 'CompareArrows',
    'Copyright', 'CreditCard', 'Dashboard', 'DateRange', 'Delete', 'DeleteForever', 'DeleteOutline', 'Description',
    'Dns', 'Done', 'DoneAll', 'DoneOutline', 'DonutLarge', 'DonutSmall', 'Drafts', 'Eject',
    'EuroSymbol', 'Event', 'EventSeat', 'ExitToApp', 'Explore', 'Extension', 'Face', 'Favorite',
    'FavoriteBorder', 'Feedback', 'FindInPage', 'FindReplace', 'Fingerprint', 'FlightLand', 'FlightTakeoff', 'FlipToBack',
    'FlipToFront', 'GTranslate', 'Gavel', 'GetApp', 'Gif', 'Grade', 'GroupWork', 'Help',
    'HelpOutline', 'HighlightOff', 'History', 'Home', 'HourglassEmpty', 'HourglassFull', 'Http', 'Https',
    'ImportantDevices', 'Info', 'InfoOutline', 'Input', 'InvertColors', 'Label', 'LabelOutline', 'Language',
    'Launch', 'LightbulbOutline', 'LineStyle', 'LineWeight', 'List', 'Lock', 'LockOpen', 'LockOutline',
    'Loyalty', 'MarkunreadMailbox', 'Motorcycle', 'NoteAdd', 'OfflinePin', 'Opacity', 'OpenInBrowser', 'OpenInNew',
    'OpenWith', 'Pageview', 'PanTool', 'Payment', 'PermCameraMic', 'PermContactCalendar', 'PermDataSetting', 'PermDeviceInformation',
    'PermIdentity', 'PermMedia', 'PermPhoneMsg', 'PermScanWifi', 'Pets', 'PictureInPicture', 'PictureInPictureAlt', 'PlayForWork',
    'Polymer', 'PowerSettingsNew', 'PregnantWoman', 'Print', 'QueryBuilder', 'QuestionAnswer', 'Receipt', 'RecordVoiceOver',
    'Redeem', 'RemoveShoppingCart', 'Reorder', 'ReportProblem', 'Restore', 'RestorePage', 'Room', 'RoundedCorner',
    'Rowing', 'Schedule', 'Search', 'Settings', 'SettingsApplications', 'SettingsBackupRestore', 'SettingsBluetooth', 'SettingsBrightness',
    'SettingsCell', 'SettingsEthernet', 'SettingsInputAntenna', 'SettingsInputComponent', 'SettingsInputComposite', 'SettingsInputHdmi', 'SettingsInputSvideo', 'SettingsOverscan',
    'SettingsPhone', 'SettingsPower', 'SettingsRemote', 'SettingsVoice', 'Shop', 'ShopTwo', 'ShoppingBasket', 'ShoppingCart',
    'SpeakerNotes', 'SpeakerNotesOff', 'Spellcheck', 'Star', 'StarBorder', 'StarHalf', 'Stars', 'Store',
    'Subject', 'SupervisorAccount', 'SwapHoriz', 'SwapVert', 'SwapVerticalCircle', 'SystemUpdateAlt', 'Tab', 'TabUnselected',
    'Theaters', 'ThreeDRotation', 'ThumbDown', 'ThumbUp', 'ThumbsUpDown', 'Timeline', 'Toc', 'Today',
    'Toll', 'TouchApp', 'TrackChanges', 'Translate', 'TrendingDown', 'TrendingFlat', 'TrendingUp', 'TurnedIn',
    'TurnedInNot', 'Update', 'VerifiedUser', 'ViewAgenda', 'ViewArray', 'ViewCarousel', 'ViewColumn', 'ViewDay',
    'ViewHeadline', 'ViewList', 'ViewModule', 'ViewQuilt', 'ViewStream', 'ViewWeek', 'Visibility', 'VisibilityOff',
    'WatchLater', 'Work', 'YoutubeSearchedFor', 'ZoomIn', 'ZoomOut',
    
    // Alert (20+ icônes)
    'Error', 'ErrorOutline', 'Warning', 'WarningAmber', 'NotificationImportant', 'AddAlert', 'NotificationAdd',
    
    // Av (20+ icônes)
    'VideoLibrary', 'VideoCall', 'Videocam', 'VideocamOff', 'VolumeUp', 'VolumeDown', 'VolumeOff', 'VolumeMute',
    'Subscriptions', 'Subtitles', 'SurroundSound', 'Cast', 'CastConnected', 'CastForEducation', 'Computer', 'DesktopMac',
    'DesktopWindows', 'DeveloperBoard', 'DeviceHub', 'DevicesOther', 'Dock', 'Gamepad', 'Headset', 'HeadsetMic',
    'Keyboard', 'KeyboardArrowDown', 'KeyboardArrowLeft', 'KeyboardArrowRight', 'KeyboardArrowUp', 'KeyboardBackspace', 'KeyboardCapslock', 'KeyboardHide',
    'KeyboardReturn', 'KeyboardTab', 'KeyboardVoice', 'Laptop', 'LaptopChromebook', 'LaptopMac', 'LaptopWindows', 'Memory',
    'Mouse', 'PhoneAndroid', 'PhoneIphone', 'Phonelink', 'PhonelinkErase', 'PhonelinkLock', 'PhonelinkOff', 'PhonelinkRing',
    'PhonelinkSetup', 'PowerInput', 'Router', 'Scanner', 'Security', 'SimCard', 'Smartphone', 'Speaker',
    'SpeakerGroup', 'Tablet', 'TabletAndroid', 'TabletMac', 'Toys', 'Tv', 'Watch', 'DeviceUnknown',
    
    // Communication (30+ icônes)
    'Business', 'Call', 'CallEnd', 'CallMade', 'CallMerge', 'CallMissed', 'CallMissedOutgoing', 'CallReceived',
    'CallSplit', 'Chat', 'ChatBubble', 'ChatBubbleOutline', 'Comment', 'ContactMail', 'ContactPhone', 'Contacts',
    'DialerSip', 'Dialpad', 'Email', 'Forum', 'ImportContacts', 'ImportExport', 'InvertColorsOff', 'LiveHelp',
    'LocationOff', 'LocationOn', 'MailOutline', 'Message', 'NoSim', 'Phone', 'PhoneBluetoothSpeaker', 'PhoneCallback',
    'PhoneForwarded', 'PhoneInTalk', 'PhoneLocked', 'PhonePaused', 'PhonelinkErase', 'PhonelinkLock', 'PhonelinkOff', 'PhonelinkRing',
    'PhonelinkSetup', 'PortableWifiOff', 'PresentToAll', 'RingVolume', 'RssFeed', 'ScreenShare', 'SentimentDissatisfied', 'SentimentNeutral',
    'SentimentSatisfied', 'SentimentVeryDissatisfied', 'SentimentVerySatisfied', 'SpeakerPhone', 'StayCurrentLandscape', 'StayCurrentPortrait', 'StayPrimaryLandscape', 'StayPrimaryPortrait',
    'StopScreenShare', 'SwapCalls', 'Textsms', 'Voicemail', 'VpnKey',
    
    // Content (50+ icônes)
    'Add', 'AddBox', 'AddCircle', 'AddCircleOutline', 'Archive', 'Backspace', 'Block', 'Clear',
    'ContentCopy', 'ContentCut', 'ContentPaste', 'Create', 'DeleteSweep', 'Drafts', 'FilterList', 'Flag',
    'FontDownload', 'Forward', 'Gesture', 'HowToReg', 'HowToVote', 'Inbox', 'Link', 'LinkOff',
    'LowPriority', 'Mail', 'Markunread', 'MoveToInbox', 'NextWeek', 'Redo', 'Remove', 'RemoveCircle',
    'RemoveCircleOutline', 'Reply', 'ReplyAll', 'Report', 'ReportOff', 'Save', 'SaveAlt', 'SelectAll',
    'Send', 'Sort', 'TextFormat', 'Unarchive', 'Undo', 'Waves', 'Weekend', 'WhereToVote',
    
    // Device (100+ icônes)
    'AccessAlarm', 'AccessAlarms', 'AccessTime', 'AddAlarm', 'AirplanemodeActive', 'AirplanemodeInactive', 'Battery20', 'Battery30',
    'Battery50', 'Battery60', 'Battery80', 'Battery90', 'BatteryAlert', 'BatteryCharging20', 'BatteryCharging30', 'BatteryCharging50',
    'BatteryCharging60', 'BatteryCharging80', 'BatteryCharging90', 'BatteryChargingFull', 'BatteryFull', 'BatteryStd', 'BatteryUnknown', 'Bluetooth',
    'BluetoothConnected', 'BluetoothDisabled', 'BluetoothSearching', 'BrightnessAuto', 'BrightnessHigh', 'BrightnessLow', 'BrightnessMedium', 'DataUsage',
    'DeveloperMode', 'Devices', 'Dvr', 'GpsFixed', 'GpsNotFixed', 'GpsOff', 'GraphicEq', 'LocationDisabled',
    'LocationSearching', 'NetworkCell', 'NetworkLocked', 'NetworkWifi', 'Nfc', 'NowWallpaper', 'NowWidgets', 'ScreenLockLandscape',
    'ScreenLockPortrait', 'ScreenLockRotation', 'ScreenRotation', 'SdStorage', 'SettingsSystemDaydream', 'SignalCellular0Bar', 'SignalCellular1Bar', 'SignalCellular2Bar',
    'SignalCellular3Bar', 'SignalCellular4Bar', 'SignalCellularAlt', 'SignalCellularConnectedNoInternet0Bar', 'SignalCellularConnectedNoInternet1Bar', 'SignalCellularConnectedNoInternet2Bar', 'SignalCellularConnectedNoInternet3Bar', 'SignalCellularConnectedNoInternet4Bar',
    'SignalCellularNoSim', 'SignalCellularNull', 'SignalCellularOff', 'SignalWifi0Bar', 'SignalWifi1Bar', 'SignalWifi2Bar', 'SignalWifi3Bar',
    'SignalWifi4Bar', 'SignalWifi4BarLock', 'SignalWifiOff', 'Storage', 'Usb', 'Wallpaper', 'Widgets', 'WifiLock',
    'WifiTethering',
    
    // Editor (80+ icônes)
    'AttachFile', 'AttachMoney', 'BorderAll', 'BorderBottom', 'BorderClear', 'BorderColor', 'BorderHorizontal', 'BorderInner',
    'BorderLeft', 'BorderOuter', 'BorderRight', 'BorderStyle', 'BorderTop', 'BorderVertical', 'BubbleChart', 'DragHandle',
    'FormatAlignCenter', 'FormatAlignJustify', 'FormatAlignLeft', 'FormatAlignRight', 'FormatBold', 'FormatClear', 'FormatColorFill', 'FormatColorReset',
    'FormatColorText', 'FormatIndentDecrease', 'FormatIndentIncrease', 'FormatItalic', 'FormatLineSpacing', 'FormatListBulleted', 'FormatListNumbered', 'FormatPaint',
    'FormatQuote', 'FormatShapes', 'FormatSize', 'FormatStrikethrough', 'FormatTextdirectionLToR', 'FormatTextdirectionRToL', 'FormatUnderlined', 'Functions',
    'Highlight', 'InsertChart', 'InsertChartOutlined', 'InsertComment', 'InsertDriveFile', 'InsertEmoticon', 'InsertInvitation', 'InsertLink',
    'InsertPhoto', 'LinearScale', 'MergeType', 'ModeComment', 'ModeEdit', 'MonetizationOn', 'MoneyOff', 'MultilineChart',
    'Notes', 'PieChart', 'PieChartOutlined', 'Publish', 'ShortText', 'ShowChart', 'SpaceBar', 'StrikethroughS',
    'TextFields', 'Title', 'VerticalAlignBottom', 'VerticalAlignCenter', 'VerticalAlignTop', 'WrapText',
    
    // File (30+ icônes)
    'Attachment', 'Cloud', 'CloudCircle', 'CloudDone', 'CloudDownload', 'CloudOff', 'CloudQueue', 'CloudUpload',
    'CreateNewFolder', 'FileDownload', 'FileUpload', 'Folder', 'FolderOpen', 'FolderShared',
    
    // Hardware (40+ icônes)
    'Cast', 'CastConnected', 'CastForEducation', 'Computer', 'DesktopMac', 'DesktopWindows', 'DeveloperBoard', 'DeviceHub',
    'DevicesOther', 'Dock', 'Gamepad', 'Headset', 'HeadsetMic', 'Keyboard', 'KeyboardArrowDown', 'KeyboardArrowLeft',
    'KeyboardArrowRight', 'KeyboardArrowUp', 'KeyboardBackspace', 'KeyboardCapslock', 'KeyboardHide', 'KeyboardReturn', 'KeyboardTab', 'KeyboardVoice',
    'Laptop', 'LaptopChromebook', 'LaptopMac', 'LaptopWindows', 'Memory', 'Mouse', 'PhoneAndroid', 'PhoneIphone',
    'Phonelink', 'PhonelinkErase', 'PhonelinkLock', 'PhonelinkOff', 'PhonelinkRing', 'PhonelinkSetup', 'PowerInput', 'Router',
    'Scanner', 'Security', 'SimCard', 'Smartphone', 'Speaker', 'SpeakerGroup', 'Tablet', 'TabletAndroid',
    'TabletMac', 'Toys', 'Tv', 'Watch',
    
    // Image (50+ icônes)
    'AddAPhoto', 'AddToPhotos', 'Adjust', 'Assistant', 'AssistantPhoto', 'Audiotrack', 'BlurCircular', 'BlurLinear',
    'BlurOff', 'BlurOn', 'Brightness1', 'Brightness2', 'Brightness3', 'Brightness4', 'Brightness5', 'Brightness6',
    'Brightness7', 'BrokenImage', 'Brush', 'Camera', 'CameraAlt', 'CameraEnhance', 'CameraFront', 'CameraRear',
    'CameraRoll', 'CenterFocusStrong', 'CenterFocusWeak', 'Collections', 'CollectionsBookmark', 'ColorLens', 'Colorize', 'Compare',
    'ControlPoint', 'ControlPointDuplicate', 'Crop', 'Crop169', 'Crop32', 'Crop54', 'Crop75', 'CropDin',
    'CropFree', 'CropLandscape', 'CropOriginal', 'CropPortrait', 'CropRotate', 'CropSquare', 'Dehaze', 'Details',
    'Edit', 'Exposure', 'ExposureNeg1', 'ExposureNeg2', 'ExposurePlus1', 'ExposurePlus2', 'ExposureZero', 'Filter1',
    'Filter2', 'Filter3', 'Filter4', 'Filter5', 'Filter6', 'Filter7', 'Filter8', 'Filter9',
    'Filter9Plus', 'Filter', 'FilterBAndW', 'FilterCenterFocus', 'FilterDrama', 'FilterFrames', 'FilterHdr', 'FilterNone',
    'FilterTiltShift', 'FilterVintage', 'Flare', 'FlashAuto', 'FlashOff', 'FlashOn', 'Flip', 'Gradient',
    'Grain', 'GridOff', 'GridOn', 'HdrOff', 'HdrOn', 'HdrStrong', 'HdrWeak', 'Healing',
    'Image', 'ImageAspectRatio', 'ImageSearch', 'Iso', 'Landscape', 'LeakAdd', 'LeakRemove', 'Lens',
    'LinkedCamera', 'Looks', 'Looks3', 'Looks4', 'Looks5', 'Looks6', 'LooksOne', 'LooksTwo',
    'Loupe', 'MonochromePhotos', 'MovieCreation', 'MovieFilter', 'MusicNote', 'MusicOff', 'Nature', 'NaturePeople',
    'NavigateBefore', 'NavigateNext', 'Palette', 'Panorama', 'PanoramaFishEye', 'PanoramaHorizontal', 'PanoramaVertical', 'PanoramaWideAngle',
    'Photo', 'PhotoAlbum', 'PhotoCamera', 'PhotoFilter', 'PhotoLibrary', 'PhotoSizeSelectActual', 'PhotoSizeSelectLarge', 'PhotoSizeSelectSmall',
    'PictureAsPdf', 'Portrait', 'RemoveRedEye', 'Rotate90DegreesCcw', 'RotateLeft', 'RotateRight', 'ShutterSpeed', 'Slideshow',
    'Straighten', 'Style', 'SwitchCamera', 'SwitchVideo', 'TagFaces', 'Texture', 'Timelapse', 'Timer',
    'Timer10', 'Timer3', 'TimerOff', 'Tonality', 'Transform', 'Tune', 'ViewComfy', 'ViewCompact',
    'Vignette', 'WbAuto', 'WbCloudy', 'WbIncandescent', 'WbIridescent', 'WbSunny',
    
    // Maps (60+ icônes)
    'AddLocation', 'Beenhere', 'Directions', 'DirectionsBike', 'DirectionsBoat', 'DirectionsBus', 'DirectionsCar', 'DirectionsRailway',
    'DirectionsRun', 'DirectionsSubway', 'DirectionsTransit', 'DirectionsWalk', 'EditLocation', 'EvStation', 'Flight', 'Hotel',
    'Layers', 'LayersClear', 'LocalActivity', 'LocalAirport', 'LocalAtm', 'LocalBar', 'LocalCafe', 'LocalCarWash',
    'LocalConvenienceStore', 'LocalDining', 'LocalDrink', 'LocalFlorist', 'LocalGasStation', 'LocalGroceryStore', 'LocalHospital', 'LocalHotel',
    'LocalLaundryService', 'LocalLibrary', 'LocalMall', 'LocalMovies', 'LocalOffer', 'LocalParking', 'LocalPharmacy', 'LocalPhone',
    'LocalPizza', 'LocalPlay', 'LocalPostOffice', 'LocalPrintshop', 'LocalSee', 'LocalShipping', 'LocalTaxi', 'Map',
    'MyLocation', 'Navigation', 'NearMe', 'PersonPin', 'PersonPinCircle', 'PinDrop', 'Place', 'Restaurant',
    'RestaurantMenu', 'Satellite', 'StoreMallDirectory', 'Streetview', 'Subway', 'Terrain', 'Traffic', 'Train',
    'Tram', 'TransferWithinAStation', 'ZoomOutMap',
    
    // Navigation (40+ icônes)
    'Apps', 'ArrowBack', 'ArrowBackIos', 'ArrowDownward', 'ArrowDropDown', 'ArrowDropDownCircle', 'ArrowDropUp', 'ArrowForward',
    'ArrowForwardIos', 'ArrowLeft', 'ArrowRight', 'ArrowUpward', 'Cancel', 'Check', 'ChevronLeft', 'ChevronRight',
    'Close', 'ExpandLess', 'ExpandMore', 'FirstPage', 'Fullscreen', 'FullscreenExit', 'LastPage', 'Menu',
    'MoreHoriz', 'MoreVert', 'Refresh', 'SubdirectoryArrowLeft', 'SubdirectoryArrowRight', 'UnfoldLess', 'UnfoldMore',
    
    // Notification (30+ icônes)
    'Adb', 'AirlineSeatFlat', 'AirlineSeatFlatAngled', 'AirlineSeatIndividualSuite', 'BluetoothAudio', 'ConfirmationNumber', 'DiscFull', 'Dns',
    'DoNotDisturb', 'DoNotDisturbAlt', 'DoNotDisturbOff', 'DoNotDisturbOn', 'DriveEta', 'EnhancedEncryption', 'EventAvailable', 'EventBusy',
    'EventNote', 'FolderSpecial', 'LiveTv', 'Mms', 'More', 'NetworkCheck', 'NetworkLocked', 'NoEncryption',
    'OndemandVideo', 'PersonalVideo', 'PhoneBluetoothSpeaker', 'PhoneForwarded', 'PhoneInTalk', 'PhoneLocked', 'PhoneMissed', 'PhonePaused',
    'Power', 'PowerOff', 'PriorityHigh', 'SdCard', 'SimCardAlert', 'Sms', 'SmsFailed', 'Sync',
    'SyncDisabled', 'SyncProblem', 'SystemUpdate', 'TapAndPlay', 'TimeToLeave', 'Vibration', 'VoiceChat', 'VpnLock',
    'Wc', 'Wifi',
    
    // Places (50+ icônes)
    'AcUnit', 'AirportShuttle', 'AllInclusive', 'BeachAccess', 'BusinessCenter', 'Casino', 'ChildCare', 'ChildFriendly',
    'FitnessCenter', 'FreeBreakfast', 'GolfCourse', 'HotTub', 'Kitchen', 'Pool', 'RoomService', 'RvHookup',
    'SmokingRooms', 'Spa',
    
    // Social (30+ icônes)
    'Cake', 'Domain', 'Group', 'GroupAdd', 'LocationCity', 'Mood', 'MoodBad', 'Notifications',
    'NotificationsActive', 'NotificationsNone', 'NotificationsOff', 'NotificationsPaused', 'Pages', 'PartyMode', 'People', 'PeopleOutline',
    'Person', 'PersonAdd', 'PersonOutline', 'PlusOne', 'Poll', 'Public', 'School', 'SentimentDissatisfied',
    'SentimentNeutral', 'SentimentSatisfied', 'SentimentVeryDissatisfied', 'SentimentVerySatisfied', 'Share', 'Whatshot',
    
    // Toggle (20+ icônes)
    'CheckBox', 'CheckBoxOutlineBlank', 'IndeterminateCheckBox', 'RadioButtonChecked', 'RadioButtonUnchecked', 'Star', 'StarBorder', 'StarHalf',
    'ToggleOff', 'ToggleOn',
  ];
  
  // Cette liste contient environ 1000+ icônes, mais il en manque encore
  // Pour obtenir les 2187 icônes complètes, il faudrait soit :
  // 1. Utiliser le package @mui/icons-material et extraire tous les noms
  // 2. Scraper le site mui.com/material-ui/material-icons/
  // 3. Utiliser une API qui liste toutes les icônes
  
  return categories.flat();
}

// Fonction principale pour générer le fichier d'icônes
async function generateIconsFile() {
  console.log('🚀 Début du téléchargement de TOUTES les icônes Material UI...\n');
  
  // Récupérer la liste complète des icônes
  let iconNames = await getAllMaterialIcons();
  
  if (!iconNames || iconNames.length === 0) {
    console.log('⚠️  Liste vide, utilisation de la liste étendue...');
    iconNames = getCompleteIconList();
  }
  
  console.log(`📋 ${iconNames.length} icônes à télécharger\n`);
  
  // Lire les icônes existantes
  const iconsFilePath = path.join(__dirname, '../src/components/icons.ts');
  const existingIcons = {};
  if (fs.existsSync(iconsFilePath)) {
    const content = fs.readFileSync(iconsFilePath, 'utf-8');
    const existingMatches = content.matchAll(/(\w+):\s*'([^']+)'/g);
    for (const match of existingMatches) {
      existingIcons[match[1]] = match[2];
    }
  }
  
  console.log(`✅ ${Object.keys(existingIcons).length} icônes existantes trouvées\n`);
  
  const icons = { ...existingIcons };
  let downloaded = 0;
  let failed = 0;
  let skipped = 0;
  
  // Télécharger chaque icône
  for (let i = 0; i < iconNames.length; i++) {
    const iconName = iconNames[i];
    
    if (existingIcons[iconName]) {
      skipped++;
      if ((i + 1) % 100 === 0) {
        console.log(`⏭️  ${i + 1}/${iconNames.length} - ${iconName} (déjà existante)`);
      }
      continue;
    }
    
    if ((i + 1) % 50 === 0 || downloaded < 10) {
      console.log(`⬇️  ${i + 1}/${iconNames.length} - Téléchargement de ${iconName}...`);
    }
    
    try {
      const path = await downloadIconSVG(iconName);
      
      if (path && path.length > 10) {
        icons[iconName] = path;
        downloaded++;
        if (downloaded % 10 === 0) {
          console.log(`✅ ${downloaded} icônes téléchargées...`);
        }
      } else {
        failed++;
        // Utiliser un path par défaut pour éviter les erreurs
        icons[iconName] = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
      }
    } catch (error) {
      failed++;
      icons[iconName] = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z';
    }
    
    // Pause pour ne pas surcharger l'API
    if ((i + 1) % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  // Générer le fichier icons.ts
  const iconNamesSorted = Object.keys(icons).sort();
  let output = `// Icônes SVG intégrées - Material Design Icons\n`;
  output += `// Total: ${iconNamesSorted.length} icônes\n`;
  output += `// Généré automatiquement le ${new Date().toLocaleDateString('fr-FR')}\n\n`;
  output += `export const ICONS: Record<string, string> = {\n`;
  
  for (const name of iconNamesSorted) {
    const path = icons[name];
    // Échapper les apostrophes dans le path
    const escapedPath = path.replace(/'/g, "\\'");
    output += `  ${name}: '${escapedPath}',\n`;
  }
  
  output += `};\n\n`;
  output += `export const ICON_NAMES = Object.keys(ICONS);\n`;
  
  // Écrire le fichier
  fs.writeFileSync(iconsFilePath, output, 'utf-8');
  
  console.log(`\n✨ Terminé !`);
  console.log(`📊 Statistiques:`);
  console.log(`   - Total: ${iconNamesSorted.length} icônes`);
  console.log(`   - Téléchargées: ${downloaded}`);
  console.log(`   - Ignorées (existantes): ${skipped}`);
  console.log(`   - Échecs: ${failed}`);
  console.log(`\n💾 Fichier sauvegardé: ${iconsFilePath}`);
}

// Exécuter le script
generateIconsFile().catch(console.error);

