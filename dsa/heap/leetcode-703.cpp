// 703. Kth Largest Element In a Stream
#include<iostream>
using namespace std;

class KthLargest {
public:
    priority_queue<int, vector<int>, greater<int>> pq_min;
    int K = INT_MAX;

    KthLargest(int k, vector<int>& nums) {
        K = k;

        for(int i=0; i<nums.size(); i++){
            pq_min.push(nums[i]);
            if(pq_min.size() > K) pq_min.pop();
        }
    }
    
    int add(int val) {
        pq_min.push(val);
        if(pq_min.size() > K) pq_min.pop();
        if(pq_min.empty()) return -1;
        return pq_min.top();
    }
};