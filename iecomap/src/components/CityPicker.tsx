import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { CITIES, City } from "../data/cities";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (city: City) => void;
}

export default function CityPicker({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return CITIES;
    return CITIES.filter((c) => c.name.toLocaleLowerCase("tr").includes(q));
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mardin — İlçe Seç</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Kapat</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="İlçe ara..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onSelect(item);
                setQuery("");
              }}
            >
              <Text style={styles.rowText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "800" },
  closeText: { color: "#E53935", fontSize: 15, fontWeight: "600" },
  searchInput: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  row: { paddingHorizontal: 20, paddingVertical: 14 },
  rowText: { fontSize: 15, color: "#222" },
  separator: { height: 1, backgroundColor: "#f0f0f0", marginLeft: 20 },
});
