use wasm_bindgen::prelude::*;
use nalgebra as na;

#[wasm_bindgen]
pub struct AABB {
    min: na::Point3<f32>,
    max: na::Point3<f32>,
}

#[wasm_bindgen]
impl AABB {
    #[wasm_bindgen(constructor)]
    pub fn new(min_x: f32, min_y: f32, min_z: f32, max_x: f32, max_y: f32, max_z: f32) -> AABB {
        AABB {
            min: na::Point3::new(min_x, min_y, min_z),
            max: na::Point3::new(max_x, max_y, max_z),
        }
    }

    pub fn intersects(&self, other: &AABB) -> bool {
        self.min.x <= other.max.x && self.max.x >= other.min.x &&
        self.min.y <= other.max.y && self.max.y >= other.min.y &&
        self.min.z <= other.max.z && self.max.z >= other.min.z
    }
}

#[wasm_bindgen]
pub struct Ray {
    origin: na::Point3<f32>,
    direction: na::Vector3<f32>,
}

#[wasm_bindgen]
impl Ray {
    #[wasm_bindgen(constructor)]
    pub fn new(origin_x: f32, origin_y: f32, origin_z: f32, dir_x: f32, dir_y: f32, dir_z: f32) -> Ray {
        Ray {
            origin: na::Point3::new(origin_x, origin_y, origin_z),
            direction: na::Vector3::new(dir_x, dir_y, dir_z).normalize(),
        }
    }

    pub fn intersects_aabb(&self, aabb: &AABB) -> bool {
        let inv_dir = na::Vector3::new(
            1.0 / self.direction.x,
            1.0 / self.direction.y,
            1.0 / self.direction.z,
        );

        let t1 = ((if inv_dir.x >= 0.0 { aabb.min.x } else { aabb.max.x }) - self.origin.x) * inv_dir.x;
        let t2 = ((if inv_dir.x >= 0.0 { aabb.max.x } else { aabb.min.x }) - self.origin.x) * inv_dir.x;
        let t3 = ((if inv_dir.y >= 0.0 { aabb.min.y } else { aabb.max.y }) - self.origin.y) * inv_dir.y;
        let t4 = ((if inv_dir.y >= 0.0 { aabb.max.y } else { aabb.min.y }) - self.origin.y) * inv_dir.y;
        let t5 = ((if inv_dir.z >= 0.0 { aabb.min.z } else { aabb.max.z }) - self.origin.z) * inv_dir.z;
        let t6 = ((if inv_dir.z >= 0.0 { aabb.max.z } else { aabb.min.z }) - self.origin.z) * inv_dir.z;

        let tmin = t1.max(t3).max(t5);
        let tmax = t2.min(t4).min(t6);

        tmax >= tmin && tmax >= 0.0
    }
} 