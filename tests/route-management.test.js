/**
 * Route Management Tests
 * Unit and integration tests for door-to-door route management
 */

import { 
  fetchRoutes, 
  createRoute, 
  startRoute,
  recordDoorVisit,
  getNextDoor,
  getRouteProgress,
  calculateDistance,
  ROUTE_STATUS,
  DOOR_OUTCOMES
} from '../js/routes.js';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  single: jest.fn(() => ({ data: null, error: null })),
  order: jest.fn(() => mockSupabase)
};

// Mock modules
jest.mock('../js/supabase.js', () => ({
  supabase: mockSupabase
}));

describe('Route Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Cooldown Logic', () => {
    test('should exclude doors in cooldown from next door suggestions', async () => {
      const mockDoors = [
        {
          id: '1',
          address: '123 Main St',
          status: 'pending',
          cooldown_until: null,
          latitude: 40.7128,
          longitude: -74.0060
        },
        {
          id: '2',
          address: '456 Oak Ave',
          status: 'pending',
          cooldown_until: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          latitude: 40.7130,
          longitude: -74.0062
        },
        {
          id: '3',
          address: '789 Pine Rd',
          status: 'pending',
          cooldown_until: new Date(Date.now() - 86400000).toISOString(), // Yesterday (expired)
          latitude: 40.7125,
          longitude: -74.0058
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockDoors.filter(d => !d.cooldown_until || new Date(d.cooldown_until) < new Date()),
          error: null
        })
      });

      const nextDoor = await getNextDoor('route-1', 40.7128, -74.0060);
      
      // Should not return door #2 (in cooldown)
      expect(nextDoor).not.toBeNull();
      expect(nextDoor.id).not.toBe('2');
    });

    test('should include doors with expired cooldown', async () => {
      const mockDoors = [
        {
          id: '1',
          address: '123 Main St',
          status: 'pending',
          cooldown_until: new Date(Date.now() - 86400000).toISOString(), // Expired
          latitude: 40.7128,
          longitude: -74.0060
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockDoors,
          error: null
        })
      });

      const nextDoor = await getNextDoor('route-1', 40.7128, -74.0060);
      expect(nextDoor).not.toBeNull();
      expect(nextDoor.id).toBe('1');
    });
  });

  describe('Distance Ordering', () => {
    test('should return closest door when location provided', async () => {
      const mockDoors = [
        {
          id: '1',
          address: '123 Main St',
          status: 'pending',
          latitude: 40.7128,
          longitude: -74.0060,
          distance: 0.5 // 0.5 km
        },
        {
          id: '2',
          address: '456 Oak Ave',
          status: 'pending',
          latitude: 40.7130,
          longitude: -74.0062,
          distance: 0.2 // 0.2 km (closest)
        },
        {
          id: '3',
          address: '789 Pine Rd',
          status: 'pending',
          latitude: 40.7125,
          longitude: -74.0058,
          distance: 1.0 // 1.0 km
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockDoors,
          error: null
        })
      });

      const nextDoor = await getNextDoor('route-1', 40.7128, -74.0060);
      
      // Should return closest door
      expect(nextDoor).not.toBeNull();
      expect(nextDoor.distance).toBeLessThanOrEqual(0.5);
    });

    test('should return first door when no location provided', async () => {
      const mockDoors = [
        {
          id: '1',
          address: '123 Main St',
          status: 'pending',
          sequence_order: 0
        },
        {
          id: '2',
          address: '456 Oak Ave',
          status: 'pending',
          sequence_order: 1
        }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockDoors,
          error: null
        })
      });

      const nextDoor = await getNextDoor('route-1');
      
      // Should return first door by sequence
      expect(nextDoor).not.toBeNull();
      expect(nextDoor.id).toBe('1');
    });
  });

  describe('Route Progress', () => {
    test('should calculate progress correctly', async () => {
      const mockDoors = [
        { id: '1', status: 'visited' },
        { id: '2', status: 'visited' },
        { id: '3', status: 'pending' },
        { id: '4', status: 'pending' }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockDoors,
          error: null
        })
      });

      const progress = await getRouteProgress('route-1');
      
      expect(progress.total).toBe(4);
      expect(progress.visited).toBe(2);
      expect(progress.remaining).toBe(2);
      expect(progress.completion_percentage).toBe(50);
    });

    test('should handle empty route', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      const progress = await getRouteProgress('route-1');
      
      expect(progress.total).toBe(0);
      expect(progress.visited).toBe(0);
      expect(progress.remaining).toBe(0);
      expect(progress.completion_percentage).toBe(0);
    });
  });

  describe('Route Status Transitions', () => {
    test('should allow starting draft route', async () => {
      const mockRoute = {
        id: 'route-1',
        status: ROUTE_STATUS.DRAFT,
        assigned_rep_id: 'user-1'
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockRoute,
          error: null
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { ...mockRoute, status: ROUTE_STATUS.ACTIVE },
          error: null
        })
      });

      const updatedRoute = await startRoute('route-1');
      
      expect(updatedRoute.status).toBe(ROUTE_STATUS.ACTIVE);
    });

    test('should not allow starting non-draft route', async () => {
      const mockRoute = {
        id: 'route-1',
        status: ROUTE_STATUS.ACTIVE,
        assigned_rep_id: 'user-1'
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockRoute,
          error: null
        })
      });

      await expect(startRoute('route-1')).rejects.toThrow('Route must be in draft status');
    });
  });
});

describe('Distance Calculation', () => {
  test('should calculate distance correctly', () => {
    // Distance between NYC and Philadelphia (approx 95 km)
    const distance = calculateDistance(40.7128, -74.0060, 39.9526, -75.1652);
    expect(distance).toBeCloseTo(95, 0);
  });

  test('should return 0 for same coordinates', () => {
    const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
    expect(distance).toBe(0);
  });
});
