export class FlightAudio {
  private context?: AudioContext;
  private engine?: OscillatorNode;
  private harmonic?: OscillatorNode;
  private gain?: GainNode;
  muted = false;
  start() {
    try {
      if(!this.context) {
        this.context=new AudioContext();
        this.gain=this.context.createGain();this.gain.gain.value=0;this.gain.connect(this.context.destination);
        const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=350;filter.connect(this.gain);
        this.engine=this.context.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=45;this.engine.connect(filter);this.engine.start();
        this.harmonic=this.context.createOscillator();this.harmonic.type='sine';this.harmonic.frequency.value=91;this.harmonic.connect(filter);this.harmonic.start();
      }
      void this.context.resume().catch(()=>{});
    } catch { /* Flight remains playable if audio is unavailable. */ }
  }
  update(throttle:number,active:boolean) {
    if(!this.context||!this.gain)return;
    const time=this.context.currentTime;
    this.gain.gain.setTargetAtTime(active&&!this.muted?.028+throttle*.035:0,time,.16);
    this.engine?.frequency.setTargetAtTime(32+throttle*42,time,.15);
    this.harmonic?.frequency.setTargetAtTime(64+throttle*84.5,time,.15);
  }
  chime() {
    if(!this.context||this.muted)return;
    [660,880,1100].forEach((frequency,i)=>{
      const osc=this.context!.createOscillator(),gain=this.context!.createGain(),t=this.context!.currentTime+i*.085;
      osc.frequency.value=frequency;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.045,t+.015);gain.gain.exponentialRampToValueAtTime(.001,t+.35);
      osc.connect(gain);gain.connect(this.context!.destination);osc.start(t);osc.stop(t+.4);
    });
  }
}
