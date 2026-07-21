import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Ponto } from "../lib/types";

interface Props {
  pontos: Ponto[];
  height?: number | string;
  follow?: boolean; // recentraliza no ponto atual (modo ao vivo)
}

const SP: Ponto = [-23.5505, -46.6333]; // fallback: São Paulo

export default function MapaRota({ pontos, height = 180, follow = true }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const linhaRef = useRef<L.Polyline | null>(null);
  const pontoRef = useRef<L.CircleMarker | null>(null);
  const centralizouRef = useRef(false);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(pontos.length ? pontos[pontos.length - 1] : SP, pontos.length ? 15 : 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    linhaRef.current = L.polyline(pontos, { color: "#c6f135", weight: 5, opacity: 0.9 }).addTo(map);
    mapRef.current = map;
    // corrige tamanho quando o container acabou de aparecer
    setTimeout(() => map.invalidateSize(), 60);

    return () => {
      map.remove();
      mapRef.current = null;
      linhaRef.current = null;
      pontoRef.current = null;
      centralizouRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza a linha e o marcador quando chegam novos pontos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    linhaRef.current?.setLatLngs(pontos);

    if (pontos.length) {
      const atual = pontos[pontos.length - 1];
      if (!pontoRef.current) {
        pontoRef.current = L.circleMarker(atual, {
          radius: 7,
          color: "#0b0e11",
          weight: 2,
          fillColor: "#2ed47a",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        pontoRef.current.setLatLng(atual);
      }

      if (!centralizouRef.current) {
        if (pontos.length > 1) map.fitBounds(L.latLngBounds(pontos).pad(0.2));
        else map.setView(atual, 15);
        centralizouRef.current = true;
      } else if (follow) {
        map.panTo(atual, { animate: true, duration: 0.5 });
      }
    }
  }, [pontos, follow]);

  return <div ref={divRef} style={{ height, width: "100%", borderRadius: 16, overflow: "hidden" }} />;
}
