import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
      return;
    }
    this.client = createClient(url, serviceKey);
    console.log('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    if (!this.client) throw new Error('Supabase client not initialized. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    return this.client;
  }

  // Convenience methods for real-time subscriptions
  subscribe(channel: string, callback: (payload: any) => void) {
    return this.getClient().channel(channel).on('postgres_changes', { event: '*', schema: 'public' }, callback).subscribe();
  }
}
