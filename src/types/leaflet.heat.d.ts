import * as L from 'leaflet';

declare module 'leaflet' {
  export function heatLayer(
    latlngs: Array<[number, number, number] | [number, number] | L.LatLng>,
    options?: HeatMapOptions
  ): HeatLayer;

  export interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: number]: string };
  }

  export interface HeatLayer extends L.Layer {
    setLatLngs(latlngs: Array<[number, number, number] | [number, number] | L.LatLng>): this;
    addLatLng(latlng: [number, number, number] | [number, number] | L.LatLng): this;
    setOptions(options: HeatMapOptions): this;
    redraw(): this;
  }
}
