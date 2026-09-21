// Required testIDs: placeholder-screen
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

// Placeholder screen component for testing scaffold
const PlaceholderScreen = () => (
  <View testID="placeholder-screen" />
);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Tabs: { Screen: () => null },
}));

describe('PlaceholderScreen', () => {
  it('renders without crashing', () => {
    render(<PlaceholderScreen />);
    expect(screen.getByTestId('placeholder-screen')).toBeTruthy();
  });
});
