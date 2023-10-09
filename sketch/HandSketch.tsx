import dynamic from "next/dynamic";
import p5Types from "p5";
import { MutableRefObject, useRef } from "react";
import { Hand } from "@tensorflow-models/hand-pose-detection";
import { getSmoothedHandpose } from "../lib/getSmoothedHandpose";
import { convertHandToHandpose } from "../lib/converter/convertHandToHandpose";
import { Monitor } from "../components/Monitor";
import { Handpose } from "../@types/global";
import { DisplayHands } from "../lib/DisplayHandsClass";
import { HandposeHistory } from "../lib/HandposeHitsoryClass";
import * as Tone from "tone";
import Matter from "matter-js";
import { Event } from "../lib/EventClass";
import { Effect } from "../lib/EffectClass";
import { Opacity } from "../lib/OpacityClass";
import { Point } from "../lib/PointClass";
import { Ball } from "../lib/BallClass";
import { ScoreMonitor } from "../lib/ScoreMonitor";
import { drawMatterBody } from "../lib/p5/drawMatterBody";
import { getCurrentPosition } from "../lib/getCurrentPosition";

type Props = {
  handpose: MutableRefObject<Hand[]>;
};
const Sketch = dynamic(import("react-p5"), {
  loading: () => <></>,
  ssr: false,
});

export const HandSketch = ({ handpose }: Props) => {
  // module aliases
  let Engine = Matter.Engine,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;
  const floorWidth = 1500;

  const floors: Matter.Body[] = [];
  for (let i = 0; i < 5; i++) {
    floors.push(
      Bodies.rectangle(
        window.innerWidth / 2 + (floorWidth / 5) * (i - 2),
        (window.innerHeight / 3) * 2,
        floorWidth / 5,
        10,
        //@ts-ignore
        { chamfer: 0, isStatic: true }
      )
    );
  }

  const points: Point[] = [];
  for (let i = 0; i < 3; i++) {
    points.push(
      new Point({
        position: {
          x: window.innerWidth * (Math.random() * 0.8 + 0.1),
          y: window.innerHeight * (Math.random() * 0.3 + 0.1),
        },
        size: 30,
      })
    );
  }
  const events = [new Event("+1", 50)];

  const balls: Ball[] = [];
  for (let i = 0; i < 1; i++) {
    balls.push(new Ball({ x: window.innerWidth / 2, y: -1000 }, 80));
  }

  const effectList: Effect[] = [];

  const opacity = new Opacity();

  const score = useRef<number>(0);
  const bestScore = useRef<number>(0);
  const displayScore = useRef<number>(0);
  const displayBestScore = useRef<number>(0);

  // create an engine
  let engine: Matter.Engine;
  const handposeHistory = new HandposeHistory();
  const displayHands = new DisplayHands();
  const r = 150;
  const offset = 60;
  const multi = 1.3;

  const distList: number[] = new Array(10).fill(0);
  const player = new Tone.Player(
    "https://k1105.github.io/sound_effect/audio/wood_attack.m4a"
  ).toDestination();

  const debugLog = useRef<{ label: string; value: any }[]>([]);

  const preload = (p5: p5Types) => {
    // 画像などのロードを行う
  };

  const setup = (p5: p5Types, canvasParentRef: Element) => {
    p5.createCanvas(p5.windowWidth, p5.windowHeight).parent(canvasParentRef);
    p5.stroke(220);
    p5.fill(220);
    p5.strokeWeight(10);

    engine = Engine.create();
    Composite.add(engine.world, [...balls.map((b) => b.body), ...floors]);
  };

  const draw = (p5: p5Types) => {
    const rawHands: {
      left: Handpose;
      right: Handpose;
    } = convertHandToHandpose(handpose.current);
    handposeHistory.update(rawHands);
    const hands: {
      left: Handpose;
      right: Handpose;
    } = getSmoothedHandpose(rawHands, handposeHistory); //平滑化された手指の動きを取得する

    // logとしてmonitorに表示する
    debugLog.current = [];
    for (const hand of handpose.current) {
      debugLog.current.push({
        label: hand.handedness + " accuracy",
        value: hand.score,
      });
    }

    p5.clear();
    displayHands.update(hands);

    let start;
    let end;

    if (displayHands.left.pose.length > 0) {
      const hand = displayHands.left.pose;
      for (let n = 0; n < 5; n++) {
        if (n === 0) {
          start = 2;
        } else {
          start = 4 * n + 1;
        }
        end = 4 * n + 4;
        distList[2 * n] = Math.min(
          Math.max((hand[start].y - hand[end].y) * multi, 0),
          r
        );
      }
    }

    if (displayHands.right.pose.length > 0) {
      const hand = displayHands.right.pose;
      for (let n = 0; n < 5; n++) {
        if (n === 0) {
          start = 2;
        } else {
          start = 4 * n + 1;
        }
        end = 4 * n + 4;
        distList[2 * n + 1] = Math.min(
          Math.max((hand[start].y - hand[end].y) * multi, 0),
          r
        );
      }
    }

    p5.push();
    p5.translate(window.innerWidth / 2, (2.5 * window.innerHeight) / 3);

    let theta = 0;

    for (let i = 0; i < 5; i++) {
      const leftDist = distList[2 * i];
      const rightDist = distList[2 * i + 1];
      [leftDist, rightDist].forEach((d, index) => {
        const sign = (-1) ** (1 - index); //正負の符号
        d = -d;
        p5.push();
        p5.translate(sign * offset, 0);
        p5.line(0, 0, (sign * Math.sqrt(r ** 2 - d ** 2)) / 2, d / 2);
        p5.translate((sign * Math.sqrt(r ** 2 - d ** 2)) / 2, d / 2);
        p5.line(0, 0, -(sign * Math.sqrt(r ** 2 - d ** 2)) / 2, d / 2);

        p5.translate(-(sign * Math.sqrt(r ** 2 - d ** 2)) / 2, d / 2);

        p5.pop();
      });

      p5.translate(0, -(leftDist + rightDist) / 2);
      //yBase += (tmp_l_d + tmp_r_d) / 2;
      p5.rotate(Math.atan2(leftDist - rightDist, 2 * offset));
      theta += Math.atan2(leftDist - rightDist, 2 * offset);
    }

    p5.push();
    p5.rectMode(p5.CENTER);
    p5.fill(220);
    p5.noStroke();
    p5.rect(0, 0, floorWidth, 10);
    p5.pop();
    const pos = getCurrentPosition(p5);
    for (let i = 0; i < floors.length; i++) {
      Matter.Body.setPosition(
        floors[i],
        {
          x: pos.x + (floorWidth / 5) * (i - 2) * Math.cos(theta),
          y: pos.y + (floorWidth / 5) * (i - 2) * Math.sin(theta),
        },
        //@ts-ignore
        true
      );
      Matter.Body.setAngle(floors[i], theta);
    }
    p5.pop();

    p5.push();
    p5.noStroke();
    for (const ball of balls) {
      const circle = ball.body;
      if (
        circle.position.y > p5.height + 200 ||
        circle.position.x > p5.width + 200 ||
        circle.position.x < -200
      ) {
        Composite.remove(engine.world, ball.body);
        const target = balls.indexOf(ball);
        balls.splice(target, 1);
      }

      for (const event of events) {
        if (event.state == "born") event.state = "alive";
        event.update(ball);

        if (event.state == "hit") {
          effectList.push(new Effect(event.position));
          if (event.type == "x2") {
            Matter.Body.scale(circle, 2, 2);
            ball.setMultiply(2);
            ball.updateScale(2);
          } else if (event.type == "x0.5") {
            Matter.Body.scale(circle, 0.5, 0.5);
            ball.setMultiply(0.5);
            ball.updateScale(0.5);
          } else if (event.type == "+1") {
            const newBall = new Ball(
              { x: window.innerWidth / 2, y: -1000 },
              80
            );
            balls.push(newBall);
            Composite.add(engine.world, newBall.body);
          }
          event.state = "dead";
        }

        if (event.isExpired()) {
          if (event.type == "x2" || event.type == "x0.5") {
            for (const targetBall of balls) {
              const scale = 1 / targetBall.getMultiply();
              if (scale !== 1) {
                Matter.Body.scale(targetBall.body, scale, scale);
                targetBall.updateScale(scale);
                targetBall.setMultiply(1);
                break;
              }
            }
          }
          const target = events.indexOf(event);
          events.splice(target, 1);
        }
      }

      bestScore.current = Math.max(score.current, bestScore.current);
    }

    if (balls.length == 0) {
      const newBall = new Ball({ x: window.innerWidth / 2, y: -1000 }, 80);
      balls.push(newBall);
      Composite.add(engine.world, newBall.body);
      score.current = 0;
      opacity.pulse();
    }

    Engine.update(engine);

    // p5.rect(300, 300, 10, 100);
    // p5.rect(300, 390, 300, 10);
    // p5.rect(600, 300, 10, 100);

    // 長方形の描画
    // for (const floor of floors) drawMatterBody(floor, p5);

    for (const point of points) {
      point.update(balls, score);
      if (point.state == "hit") {
        //play a middle 'C' for the duration of an 8th note
        Tone.loaded().then(() => {
          player.start();
        });
        effectList.push(new Effect(point.position));
        point.state = "dying";
      }
      if (point.state == "dead") {
        const target = points.indexOf(point);
        points.splice(target, 1);
      }
    }

    for (const effect of effectList) {
      effect.update();
      effect.show(p5);
      if (effect.state == "dead") {
        const target = effectList.indexOf(effect);
        effectList.splice(target, 1);
      }
    }

    if (points.length == 0) {
      setTimeout(function () {
        while (points.length < 3) {
          points.push(
            new Point({
              position: {
                x: window.innerWidth * (Math.random() * 0.8 + 0.1),
                y: window.innerHeight * (Math.random() * 0.3 + 0.1),
              },
              size: 30,
            })
          );
        }
      }, 1000);
    }

    opacity.update();

    /* draw circle */
    for (const ball of balls) {
      ball.show(p5);
    }
    for (const event of events) event.show(p5);
    for (const point of points) point.show(p5);

    /*Score */

    if (displayScore.current !== score.current) {
      if (score.current > displayScore.current) {
        displayScore.current = Math.min(
          displayScore.current + 1,
          score.current
        );
      } else {
        displayScore.current = Math.max(
          displayScore.current - 1,
          score.current
        );
      }
    }
    displayBestScore.current = Math.max(
      displayScore.current,
      displayBestScore.current
    );

    p5.translate(0, p5.height - 200);
    ScoreMonitor({
      score: displayScore.current,
      bestScore: displayBestScore.current,
      p5,
    });

    /* Score */

    p5.pop();
  };

  const windowResized = (p5: p5Types) => {
    p5.resizeCanvas(p5.windowWidth, p5.windowHeight);
  };

  return (
    <>
      <Monitor handpose={handpose} debugLog={debugLog} />
      {/* <Recorder handpose={handpose} /> */}
      <Sketch
        preload={preload}
        setup={setup}
        draw={draw}
        windowResized={windowResized}
      />
    </>
  );
};
