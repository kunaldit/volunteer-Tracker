import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat'; // Import heatmap plugin
import axios from 'axios';
import io from 'socket.io-client';

// Fix for default markers in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const HeatmapLayer = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    // Convert points to [lat, lng, intensity] format
    const heatmapPoints = points.map(point => [
      point.latitude,
      point.longitude,
      point.intensity || 0.5
    ]);

    // Create heatmap layer
    const heatmapLayer = L.heatLayer(heatmapPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.0: '#313695',
        0.1: '#4575b4',
        0.2: '#74add1',
        0.4: '#abd9e9',
        0.6: '#fee090',
        0.8: '#fdae61',
        1.0: '#d73027'
      }
    });

    // Add to map
    heatmapLayer.addTo(map);

    // Cleanup function
    return () => {
      map.removeLayer(heatmapLayer);
    };
  }, [map, points]);

  return null;
};

const CampaignHeatmap = () => {
  const [heatmapData, setHeatmapData] = useState([]);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Lalganj constituency bounds
  const lalganjCenter = [25.8738, 85.1797];
  const lalganjBounds = [
    [25.82, 85.10], // Southwest
    [25.90, 85.25]  // Northeast
  ];

  // Fetch initial heatmap data
  useEffect(() => {
    const fetchHeatmapData = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('http://localhost:8000/api/v1/locations/heatmap-data');
        setHeatmapData(response.data.heatmap_points);
        
        // Fetch coverage statistics
        const statsResponse = await axios.get('http://localhost:8000/api/v1/locations/coverage-stats');
        setStats(statsResponse.data);
        
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch heatmap data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeatmapData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchHeatmapData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Real-time updates via WebSocket
  useEffect(() => {
    const socket = io('http://localhost:8000', {
      transports: ['websocket']
    });

    socket.on('location_update', (newLocation) => {
      console.log('New location received:', newLocation);
      // Add new point to heatmap
      setHeatmapData(prev => [
        ...prev,
        [newLocation.latitude, newLocation.longitude, newLocation.intensity || 0.5]
      ]);
      setLastUpdate(new Date());
    });

    return () => socket.disconnect();
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      hour12: true 
    });
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Dashboard Header */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>
          Lalganj Campaign Dashboard
        </h2>
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
          <div>
            <strong>Unique Locations:</strong> {stats.unique_locations_covered || 0}
          </div>
          <div>
            <strong>Total Visits:</strong> {stats.total_visits || 0}
          </div>
          <div>
            <strong>Avg Stay:</strong> {stats.average_stay_duration || 0}s
          </div>
          <div>
            <strong>Coverage Efficiency:</strong> {stats.coverage_efficiency || 0}%
          </div>
          <div>
            <strong>Last Update:</strong> {formatTime(lastUpdate)}
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div>Loading campaign data...</div>
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        center={lalganjCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        maxBounds={lalganjBounds}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <HeatmapLayer points={heatmapData} />
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Campaign Intensity</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', backgroundColor: '#313695', display: 'inline-block' }}></span>
          <span style={{ fontSize: '12px' }}>Low</span>
          <div style={{
            width: '50px',
            height: '10px',
            background: 'linear-gradient(to right, #313695, #d73027)',
            margin: '0 5px'
          }}></div>
          <span style={{ fontSize: '12px' }}>High</span>
          <span style={{ width: '10px', height: '10px', backgroundColor: '#d73027', display: 'inline-block' }}></span>
        </div>
      </div>
    </div>
  );
};

export default CampaignHeatmap;
