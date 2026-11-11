import { safetyInformationSources } from "@glutenfree/shared";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gluten-Free Platform</Text>
      <Text style={styles.body}>
        Safety information will distinguish restaurant-provided, community-reported,
        and independently verified claims.
      </Text>
      <Text style={styles.caption}>
        Source categories: {safetyInformationSources.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  title: {
    color: "#173b32",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12
  },
  body: {
    color: "#33443e",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center"
  },
  caption: {
    color: "#52645d",
    fontSize: 13,
    marginTop: 16
  }
});
