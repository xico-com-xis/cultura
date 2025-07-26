import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { testSupabaseStorage } from '@/utils/imageUpload';
import React, { useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function StorageTestComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const runStorageTest = async () => {
    setIsLoading(true);
    try {
      const result = await testSupabaseStorage();
      
      if (result.success) {
        setTestResult(`✅ ${result.message}\nBuckets: ${result.buckets?.join(', ')}`);
        Alert.alert('Success', result.message);
      } else {
        setTestResult(`❌ ${result.message}\nBuckets: ${result.buckets?.join(', ') || 'None found'}`);
        Alert.alert('Storage Test Failed', result.message);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setTestResult(`❌ Test failed: ${errorMsg}`);
      Alert.alert('Error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Supabase Storage Test</ThemedText>
      
      <TouchableOpacity
        style={styles.button}
        onPress={runStorageTest}
        disabled={isLoading}
      >
        <ThemedText style={styles.buttonText}>
          {isLoading ? 'Testing...' : 'Test Storage Connection'}
        </ThemedText>
      </TouchableOpacity>
      
      {testResult ? (
        <View style={styles.resultContainer}>
          <ThemedText style={styles.resultText}>{testResult}</ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  resultContainer: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
