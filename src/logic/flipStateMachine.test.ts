import {
  classifyAngle,
  createInitialFlipState,
  stepFlipStateMachine,
  FlipStateMachineConfig,
} from './flipStateMachine';

const CONFIG: FlipStateMachineConfig = {
  hautMinDeg: -30,
  hautMaxDeg: 30,
  basThresholdDeg: 150,
  stabilizationMs: 120,
};

describe('classifyAngle', () => {
  test('0° est classé HAUT', () => {
    expect(classifyAngle(0, CONFIG)).toBe('HAUT');
  });

  test('180° est classé BAS', () => {
    expect(classifyAngle(180, CONFIG)).toBe('BAS');
  });

  test('-180° est classé BAS', () => {
    expect(classifyAngle(-180, CONFIG)).toBe('BAS');
  });

  test('90° est classé TRANSITION', () => {
    expect(classifyAngle(90, CONFIG)).toBe('TRANSITION');
  });
});

describe('stepFlipStateMachine', () => {
  test('reste stable sans évènement tant que HAUT est confirmé', () => {
    let state = createInitialFlipState('HAUT');
    const result = stepFlipStateMachine(state, 5, 0, CONFIG);
    expect(result.event).toBeNull();
    expect(result.state.confirmedZone).toBe('HAUT');
  });

  test('confirme HAUT -> BAS après le délai de stabilisation', () => {
    let state = createInitialFlipState('HAUT');
    let result = stepFlipStateMachine(state, 180, 0, CONFIG);
    expect(result.event).toBeNull(); // pas encore stabilisé
    state = result.state;

    result = stepFlipStateMachine(state, 180, 100, CONFIG);
    expect(result.event).toBeNull(); // 100ms < 120ms
    state = result.state;

    result = stepFlipStateMachine(state, 180, 130, CONFIG);
    expect(result.event).toBe('haut-vers-bas'); // 130ms >= 120ms
    expect(result.state.confirmedZone).toBe('BAS');
  });

  test('un rebond en TRANSITION annule la stabilisation en cours', () => {
    let state = createInitialFlipState('HAUT');

    let result = stepFlipStateMachine(state, 180, 0, CONFIG); // candidat BAS démarre à t=0
    state = result.state;

    result = stepFlipStateMachine(state, 90, 50, CONFIG); // rebond en TRANSITION -> annule
    expect(result.event).toBeNull();
    state = result.state;

    result = stepFlipStateMachine(state, 180, 60, CONFIG); // candidat BAS redémarre à t=60
    state = result.state;

    result = stepFlipStateMachine(state, 180, 170, CONFIG); // 170-60=110ms < 120ms
    expect(result.event).toBeNull();
    state = result.state;

    result = stepFlipStateMachine(state, 180, 190, CONFIG); // 190-60=130ms >= 120ms
    expect(result.event).toBe('haut-vers-bas');
  });

  test('confirme BAS -> HAUT après une première transition HAUT -> BAS', () => {
    let state = createInitialFlipState('HAUT');
    let result = stepFlipStateMachine(state, 180, 0, CONFIG);
    state = result.state;
    result = stepFlipStateMachine(state, 180, 130, CONFIG);
    expect(result.event).toBe('haut-vers-bas');
    state = result.state;

    result = stepFlipStateMachine(state, 0, 200, CONFIG);
    state = result.state;
    result = stepFlipStateMachine(state, 0, 330, CONFIG); // 330-200=130ms >= 120ms
    expect(result.event).toBe('bas-vers-haut');
  });
});
