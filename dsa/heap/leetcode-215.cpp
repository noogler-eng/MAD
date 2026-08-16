// 215. Kth Largest Element In An Array
#include<iostream>
using namespace std;

class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        priority_queue<int, vector<int>, greater<int>> pq_min;
        for(int i=0; i<nums.size(); i++){
            pq_min.push(nums[i]);
            if(pq_min.size() > k) pq_min.pop();
        }
            
        if(pq_min.empty()) return -1;
        return pq_min.top();
    }
};