import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FeedScreen } from './src/screens/FeedScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <FeedScreen />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
