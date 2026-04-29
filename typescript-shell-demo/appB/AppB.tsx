import * as React from 'react';
import { useAppBActionEvent, EVENT_TYPES } from '../shell/useActionEvent';
import {
  TestUnidentifyEvent,
  EventWithVariantSpecificAllowedValuesEvent,
  EventPropertyWithVariantSpecificAllowedValues,
  type EventPropertyWithVariantSpecificAllowedValuesValueType,
} from './avo/Avo';

const VARIANTS: EventPropertyWithVariantSpecificAllowedValuesValueType[] = [
  EventPropertyWithVariantSpecificAllowedValues.EVENT_VALUE_I,
  EventPropertyWithVariantSpecificAllowedValues.VALUE_I,
  EventPropertyWithVariantSpecificAllowedValues.VALUE_II,
  EventPropertyWithVariantSpecificAllowedValues.VARIANT_WITH__SYMBOL,
];

export const AppB = () => {
  const trackAction = useAppBActionEvent();

  const handleUnidentify = () => {
    trackAction({ event: new TestUnidentifyEvent(), type: EVENT_TYPES.ACTION });
  };

  const handleVariant = () => {
    const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)] ?? VARIANTS[0]!;
    trackAction({
      event: new EventWithVariantSpecificAllowedValuesEvent(variant),
      type: EVENT_TYPES.ACTION,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button data-testid="track-button-b" onClick={handleUnidentify}>
        Track Unidentify (App B)
      </button>
      <button data-testid="track-button-b-variant" onClick={handleVariant}>
        Track Beverage Variant (App B)
      </button>
    </div>
  );
};
