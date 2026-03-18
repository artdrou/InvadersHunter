import { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import WebMap from "@/components/ui/web-map";
import { api } from "@/services/api";

export default function MapScreen() {
  const [invaders, setInvaders] = useState([]);

  useEffect(() => {
    api
      .get("/invaders")
      .then((res) => {
        console.log("INVADERS:", res.data);
        setInvaders(res.data);
      })
      .catch((err) => {
        console.error("API ERROR:", err);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.debug}>Invaders: {invaders.length}</Text>
      <WebMap invaders={invaders}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  debug: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: "white",
    padding: 8,
  },
});