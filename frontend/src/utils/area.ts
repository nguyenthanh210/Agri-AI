export const calculatePolygonArea = (coords: Array<{ latitude: number; longitude: number }>) => {
  if (!coords || coords.length < 3) return 0;
  
  const R = 6371000; // Earth's mean radius in meters
  let area = 0;
  
  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    
    // Convert to radians and then to approximate local Cartesian coordinates
    const x1 = (p1.longitude * Math.PI * R * Math.cos((p1.latitude * Math.PI) / 180)) / 180;
    const y1 = (p1.latitude * Math.PI * R) / 180;
    
    const x2 = (p2.longitude * Math.PI * R * Math.cos((p2.latitude * Math.PI) / 180)) / 180;
    const y2 = (p2.latitude * Math.PI * R) / 180;
    
    // Shoelace formula component
    area += x1 * y2 - x2 * y1;
  }
  
  // Calculate absolute area, divide by 2 for Shoelace, and divide by 10000 for Hectares
  const areaInHectares = Math.abs(area / 2) / 10000;
  
  return parseFloat(areaInHectares.toFixed(2));
};
