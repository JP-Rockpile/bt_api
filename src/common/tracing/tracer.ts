import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export function initTracing() {
  const serviceName = process.env.OTEL_SERVICE_NAME || 'bt-api';
  const jaegerEndpoint = process.env.JAEGER_ENDPOINT;

  const exporter = jaegerEndpoint
    ? new JaegerExporter({
        endpoint: jaegerEndpoint,
      })
    : undefined;

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable fs instrumentation for performance
        },
      }),
    ],
  });

  sdk.start();

  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error));
  });
}

export function getTracer() {
  return sdk;
}
