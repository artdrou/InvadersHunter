import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [region, setRegion] = useState({
    latitude: 48.8566,  // Paris par défaut
    longitude: 2.3522,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [userLocation, setUserLocation] = useState(null);

  // Demander la permission de géolocalisation au démarrage
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'L\'accès à la localisation est nécessaire pour centrer la carte sur votre position.'
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const userPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(userPos);
      
      // Centrer la carte sur la position de l'utilisateur
      setRegion({
        ...userPos,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    })();
  }, []);

  // Fonction pour recentrer sur la position de l'utilisateur
  const centerOnUser = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({});
      const userPos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(userPos);
      setRegion({
        ...userPos,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de récupérer votre position');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Marqueur de la position de l'utilisateur (optionnel car showsUserLocation le fait) */}
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="Ma position"
            pinColor="blue"
          />
        )}
      </MapView>

      {/* Bouton pour recentrer sur la position */}
      <TouchableOpacity 
        style={styles.centerButton} 
        onPress={centerOnUser}
      >
        <Text style={styles.buttonText}>📍 Ma position</Text>
      </TouchableOpacity>

      {/* Info en bas */}
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          🗺️ Carte Interactive - Étape 1
        </Text>
        <Text style={styles.infoTextSmall}>
          Zoomez avec vos doigts, déplacez-vous sur la carte
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  centerButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoBox: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  infoTextSmall: {
    fontSize: 12,
    color: '#666',
  },
});
