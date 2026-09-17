import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { generateQRCodeMatrix, ErrorCorrectionLevel } from '../utils/qrCode';

interface QRCodeSvgProps {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  quietZone?: number;
  ecl?: ErrorCorrectionLevel;
}

export const QRCodeSvg: React.FC<QRCodeSvgProps> = ({
  value,
  size = 220,
  color = '#000000',
  backgroundColor = '#FFFFFF',
  quietZone = 2,
  ecl = 'M',
}) => {
  const { pathData, viewBoxSize } = useMemo(() => {
    if (!value) {
      return { pathData: '', viewBoxSize: 1 };
    }

    try {
      const matrix = generateQRCodeMatrix(value, ecl);
      const matrixSize = matrix.length;
      const totalSize = matrixSize + quietZone * 2;

      let d = '';
      for (let y = 0; y < matrixSize; y++) {
        for (let x = 0; x < matrixSize; x++) {
          if (matrix[y][x]) {
            const posX = x + quietZone;
            const posY = y + quietZone;
            // Draw a 1x1 module square
            d += `M${posX},${posY}h1v1h-1z `;
          }
        }
      }

      return { pathData: d, viewBoxSize: totalSize };
    } catch {
      return { pathData: '', viewBoxSize: 1 };
    }
  }, [value, ecl, quietZone]);

  if (!pathData) {
    return <View style={{ width: size, height: size, backgroundColor }} />;
  }

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor }]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      >
        <Rect width={viewBoxSize} height={viewBoxSize} fill={backgroundColor} />
        <Path d={pathData} fill={color} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
