import { Injectable, Logger } from '@nestjs/common';
import { getConnectorConfig } from '../connectors/connector-config';
import { ToolCall, ToolResult } from './types';

interface McpConnectorConfig {
  baseUrl: string;
  authHeader?: string;
  timeoutMs: number;
}

@Injectable()
export class McpConnectorExecutor {
  private readonly logger = new Logger(McpConnectorExecutor.name);
  private configs = new Map<string, McpConnectorConfig>();

  registerConnector(connectorId: string, config: McpConnectorConfig) {
    this.configs.set(connectorId, config);
    this.logger.log('Registered MCP connector: ' + connectorId + ' at ' + config.baseUrl);
  }

  async execute(toolName: string, call: ToolCall): Promise<ToolResult> {
    const start = Date.now();
    const handlerParts = toolName.split(':');
    const connectorType = handlerParts[0];
    const action = handlerParts[1] || 'execute';

    if (connectorType !== 'mcp') {
      return { success: false, error: 'Not an MCP tool: ' + toolName, durationMs: Date.now() - start };
    }

    const connectorId = handlerParts.length > 2 ? handlerParts[2] : null;
    if (!connectorId) {
      return { success: false, error: 'No connector ID specified for MCP tool', durationMs: Date.now() - start };
    }

    const config = this.configs.get(connectorId);
    if (!config) {
      return { success: false, error: 'MCP connector not configured: ' + connectorId, durationMs: Date.now() - start };
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.authHeader) headers['Authorization'] = config.authHeader;

      const response = await Promise.race([
        fetch(config.baseUrl + '/tools/' + action + '/call', {
          method: 'POST',
          headers,
          body: JSON.stringify({ idempotencyKey: call.idempotencyKey, arguments: call.arguments }),
        }),
        new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('MCP connector timeout')), config.timeoutMs)),
      ]);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { success: false, error: 'MCP error (' + response.status + '): ' + errText.substring(0, 200), durationMs: Date.now() - start };
      }

      const data = await response.json();
      return { success: true, output: data, durationMs: Date.now() - start };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: 'MCP connection failed: ' + msg, durationMs: Date.now() - start };
    }
  }

  async healthCheck(connectorId: string): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const config = this.configs.get(connectorId);
    if (!config) return { healthy: false, latencyMs: 0, error: 'Not registered' };
    try {
      const start = Date.now();
      const resp = await fetch(config.baseUrl + '/health', { method: 'GET' });
      return { healthy: resp.ok, latencyMs: Date.now() - start };
    } catch (e) {
      return { healthy: false, latencyMs: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
