import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/features/auth";

export default function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleLogout}>
        <Text style={styles.buttonText}>Disconnect</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    borderWidth: 1,
    borderColor: '#ff0062',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ff0062',
    fontWeight: 'bold',
    fontSize: 16,
  },
});