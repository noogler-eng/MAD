// 1046.  Last Stone Weight
#include<iostream>
using namespace std;

class Solution {
public:
    int lastStoneWeight(vector<int>& stones) {
        priority_queue<int> pq_max;

        for(int i=0; i<stones.size(); i++) pq_max.push(stones[i]);
        while(pq_max.size() > 1){
            int x = pq_max.top(); pq_max.pop();
            int y = pq_max.top(); pq_max.pop();

            if(x == y) continue;
            if(x < y) {
                y = y - x;
                pq_max.push(y);
            }else{
                x = x - y;
                pq_max.push(x);
            }
        }

        if(pq_max.empty()) return 0;
        return pq_max.top();
    }
};