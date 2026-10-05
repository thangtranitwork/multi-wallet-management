import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

// Cấu hình ngôn ngữ Tiếng Việt cho dayjs toàn ứng dụng
dayjs.locale('vi');

import App from './App';
import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';
import { initLogger } from './src/services/loggerService';

// Khởi tạo logger ghi nhận nhật ký hệ thống
initLogger();

// Đăng ký trình xử lý tác vụ nền cho Android Home Screen Widget
registerWidgetTaskHandler(widgetTaskHandler);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
