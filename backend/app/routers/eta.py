"""ETA endpoints (FR09)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..clock import effective_time
from ..models import User
from ..schemas import EtaOut
from ..security import get_current_user
from ..services.eta import eta_for

router = APIRouter(tags=["eta"])


@router.get("/eta", response_model=EtaOut)
def get_eta(bus_id: int = Query(...), stop_id: int = Query(...),
            when: datetime = Depends(effective_time), _: User = Depends(get_current_user)):
    res = eta_for(bus_id, stop_id, when)
    if res is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bus not live or stop not on its route")
    return EtaOut(bus_id=bus_id, stop_id=stop_id, eta_minutes=res.eta_minutes, distance_m=res.distance_m,
                  smoothed_speed_kmh=res.smoothed_speed_kmh, predicted_delay_min=res.total_delay_min,
                  confidence=res.confidence)


@router.get("/eta/bus/{bus_id}", response_model=list[EtaOut])
def eta_all_stops(bus_id: int, when: datetime = Depends(effective_time), _: User = Depends(get_current_user)):
    """ETA from one bus to every stop on its route (the ETA table on the bus page)."""
    from ..simulator import simulator

    st = simulator.buses.get(bus_id)
    if st is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bus not live")
    out, seen = [], set()
    for stop in st.geom.stops:
        if stop.stop_id in seen:
            continue
        seen.add(stop.stop_id)
        res = eta_for(bus_id, stop.stop_id, when)
        if res:
            out.append(EtaOut(bus_id=bus_id, stop_id=stop.stop_id, eta_minutes=res.eta_minutes,
                              distance_m=res.distance_m, smoothed_speed_kmh=res.smoothed_speed_kmh,
                              predicted_delay_min=res.total_delay_min, confidence=res.confidence))
    return sorted(out, key=lambda e: e.eta_minutes)


@router.get("/stops/{stop_id}/arrivals", response_model=list[EtaOut])
def stop_arrivals(stop_id: int, when: datetime = Depends(effective_time), _: User = Depends(get_current_user)):
    """Every live bus whose route serves this stop, soonest first."""
    from ..simulator import simulator

    out = []
    for bus_id in list(simulator.buses):
        res = eta_for(bus_id, stop_id, when)
        if res:
            out.append(EtaOut(bus_id=bus_id, stop_id=stop_id, eta_minutes=res.eta_minutes,
                              distance_m=res.distance_m, smoothed_speed_kmh=res.smoothed_speed_kmh,
                              predicted_delay_min=res.total_delay_min, confidence=res.confidence))
    return sorted(out, key=lambda e: e.eta_minutes)
