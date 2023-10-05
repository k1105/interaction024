import Matter from "matter-js";
import p5Types from "p5";

export const drawMatterBody = (body: Matter.Body, p5: p5Types) => {
  p5.push();
  p5.noFill();
  p5.stroke(255, 0, 0);
  p5.strokeWeight(1);
  p5.beginShape();
  for (let j = 0; j < 4; j++) p5.vertex(body.vertices[j].x, body.vertices[j].y);
  p5.endShape(p5.CLOSE);
  p5.pop();
};
